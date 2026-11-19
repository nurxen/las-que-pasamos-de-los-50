// Capa de datos: Supabase (compartido) o modo demo (solo en este navegador)
const cfg = window.APP_CONFIG || {};
export const IS_DEMO = !cfg.SUPABASE_URL || !cfg.SUPABASE_KEY;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

// ---------------------------------------------------------------- Supabase
async function supabaseBackend() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async checkCode(code) { return ok(await sb.rpc("check_group_code", { code })); },
    async loadAll(sinceDay) {
      const [members, challenges, entries, cheers] = await Promise.all([
        sb.from("members").select("*").order("created_at"),
        sb.from("challenges").select("*").order("created_at"),
        sb.from("entries").select("*").gte("day", sinceDay),
        sb.from("cheers").select("*").gte("week_start", sinceDay),
      ]);
      return { members: ok(members), challenges: ok(challenges), entries: ok(entries), cheers: ok(cheers) };
    },
    async saveMember(m) {
      if (m.id) return ok(await sb.from("members").update({ name: m.name, emoji: m.emoji, color: m.color, motto: m.motto }).eq("id", m.id).select().single());
      return ok(await sb.from("members").insert({ name: m.name, emoji: m.emoji, color: m.color, motto: m.motto || "" }).select().single());
    },
    async saveChallenge(c) {
      const row = { member_id: c.member_id, title: c.title, emoji: c.emoji, mode: c.mode, target: c.target, unit: c.unit || "" };
      if (c.id) return ok(await sb.from("challenges").update(row).eq("id", c.id).select().single());
      return ok(await sb.from("challenges").insert(row).select().single());
    },
    async archiveChallenge(id) { return ok(await sb.from("challenges").update({ archived_at: new Date().toISOString() }).eq("id", id)); },
    async addEntry(e) { return ok(await sb.from("entries").insert(e).select().single()); },
    async deleteEntry(id) { return ok(await sb.from("entries").delete().eq("id", id)); },
    async addCheer(c) { return ok(await sb.from("cheers").insert(c).select().single()); },
    subscribe(cb) {
      sb.channel("retadoras")
        .on("postgres_changes", { event: "*", schema: "public" }, cb)
        .subscribe();
    },
  };
}

// ---------------------------------------------------------------- Demo
function demoBackend() {
  const KEY = "retadoras_demo_db";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  let db = load() || seed();
  save(db);
  const now = () => new Date().toISOString();
  return {
    async checkCode(code) { return String(code).trim().toLowerCase() === "amigas"; },
    async loadAll(sinceDay) {
      return {
        members: [...db.members], challenges: [...db.challenges],
        entries: db.entries.filter((e) => e.day >= sinceDay),
        cheers: db.cheers.filter((c) => c.week_start >= sinceDay),
      };
    },
    async saveMember(m) {
      if (m.id) { const i = db.members.findIndex((x) => x.id === m.id); db.members[i] = { ...db.members[i], ...m }; save(db); return db.members[i]; }
      const row = { ...m, id: uid(), created_at: now() }; db.members.push(row); save(db); return row;
    },
    async saveChallenge(c) {
      if (c.id) { const i = db.challenges.findIndex((x) => x.id === c.id); db.challenges[i] = { ...db.challenges[i], ...c }; save(db); return db.challenges[i]; }
      const row = { ...c, id: uid(), created_at: now(), archived_at: null }; db.challenges.push(row); save(db); return row;
    },
    async archiveChallenge(id) { const c = db.challenges.find((x) => x.id === id); if (c) c.archived_at = now(); save(db); },
    async addEntry(e) { const row = { ...e, id: uid(), created_at: now() }; db.entries.push(row); save(db); return row; },
    async deleteEntry(id) { db.entries = db.entries.filter((e) => e.id !== id); save(db); },
    async addCheer(c) { const row = { ...c, id: uid(), created_at: now() }; db.cheers.push(row); save(db); return row; },
    subscribe() {},
  };
}

// Datos de ejemplo para el modo demo
function seed() {
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const mon = new Date(today); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const longAgo = new Date(mon); longAgo.setDate(longAgo.getDate() - 60);
  const people = [
    ["Carmen", "🌸", "#E8579B", "Paso a paso, pero sin parar"],
    ["Lola", "🍸", "#7B3FA0", "Primero el reto, luego el brunch"],
    ["Marisa", "☕", "#F28C38", "Café en mano y a por todas"],
    ["Pilar", "👑", "#2E9C9A", "Reina de mi semana"],
    ["Rosa", "🦋", "#D94848", "Este año, sí"],
  ];
  const ideas = [
    ["🚶‍♀️", "Andar", "cantidad", 5, "km"], ["🥗", "Comer saludable", "dias", 5, ""],
    ["📖", "Leer", "cantidad", 100, "páginas"], ["🧘‍♀️", "Hacer yoga", "dias", 3, ""],
    ["💧", "Beber 2 litros de agua", "dias", 5, ""], ["📞", "Llamar a mi madre", "cantidad", 2, "llamadas"],
  ];
  const db = { members: [], challenges: [], entries: [], cheers: [] };
  let seedN = 7;
  const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; };
  people.forEach(([name, emoji, color, motto], i) => {
    const m = { id: uid(), name, emoji, color, motto, created_at: longAgo.toISOString() };
    db.members.push(m);
    for (let k = 0; k < 3; k++) {
      const [e, t, mode, target, unit] = ideas[(i + k * 2) % ideas.length];
      const c = { id: uid(), member_id: m.id, title: t, emoji: e, mode, target, unit, created_at: longAgo.toISOString(), archived_at: null };
      db.challenges.push(c);
      for (let w = 0; w < 8; w++) {
        for (let d = 0; d < 7; d++) {
          const day = new Date(mon); day.setDate(day.getDate() - w * 7 + d);
          if (day > today) continue;
          const effort = 0.35 + 0.12 * ((i + w) % 5);
          if (rnd() < effort) {
            const amount = mode === "dias" ? 1 : Math.max(1, Math.round((target / 4) * (0.5 + rnd())));
            db.entries.push({ id: uid(), challenge_id: c.id, member_id: m.id, day: ymd(day), amount, created_at: day.toISOString() });
          }
        }
      }
    }
  });
  return db;
}

export async function createStore() {
  if (IS_DEMO) return demoBackend();
  return supabaseBackend();
}
