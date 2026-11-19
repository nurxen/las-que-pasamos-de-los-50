import { createStore, IS_DEMO } from "./store.js";
import { PHRASES, phraseForPct, weekVerdict, groupVerdict, SUGGESTIONS, CHALLENGE_EMOJIS, AVATARS, COLORS, CHEER_EMOJIS, GROUP_CHALLENGES, PRENDAS, QUICK_MESSAGES } from "./content.js";

const APP_NAME = (window.APP_CONFIG && window.APP_CONFIG.APP_NAME) || "Retos de Las q pasamos d 50's";
const LS = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

// ------------------------------------------------------------------ fechas
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d = new Date()) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const isoDay = (iso) => ymd(new Date(iso));
const DAY_LETTERS = ["L", "M", "X", "J", "V", "S", "D"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const longDate = (d) => `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
const shortRange = (ws) => { const we = addDays(ws, 6); return ws.getMonth() === we.getMonth() ? `${ws.getDate()}–${we.getDate()} de ${MONTHS[we.getMonth()]}` : `${ws.getDate()} ${MONTHS[ws.getMonth()].slice(0, 3)} – ${we.getDate()} ${MONTHS[we.getMonth()].slice(0, 3)}`; };

// ------------------------------------------------------------------ utilidades
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => { const r = Math.round(Number(n) * 10) / 10; return String(r).replace(".", ","); };
const pctTxt = (p) => `${Math.round((p || 0) * 100)}%`;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ------------------------------------------------------------------ estado
const S = {
  store: null,
  data: { members: [], challenges: [], entries: [], cheers: [], messages: [] },
  me: LS.get("rt_me"),
  tab: "home",
  homeOffset: 0, // 0 = esta semana, -1 = semana pasada (para apuntar lo olvidado)
  summaryOffset: 0,
  loading: true,
  busy: new Set(), // evita dobles toques
};
if (LS.get("rt_big")) document.documentElement.classList.add("big-text");
const root = document.getElementById("app");
const today = () => new Date();
const thisMonday = () => mondayOf(today());
const me = () => S.data.members.find((m) => m.id === S.me);
const member = (id) => S.data.members.find((m) => m.id === id);

// ------------------------------------------------------------------ cálculos
function challengesForWeek(memberId, ws) {
  const end = ymd(addDays(ws, 6));
  return S.data.challenges.filter((c) => c.member_id === memberId && isoDay(c.created_at) <= end && (!c.archived_at || isoDay(c.archived_at) > end));
}
function entriesFor(c, ws) {
  const start = ymd(ws), end = ymd(addDays(ws, 6));
  return S.data.entries.filter((e) => e.challenge_id === c.id && e.day >= start && e.day <= end);
}
function progress(c, ws) {
  const es = entriesFor(c, ws);
  const done = c.mode === "dias" ? new Set(es.map((e) => e.day)).size : es.reduce((a, e) => a + Number(e.amount), 0);
  const target = Number(c.target) || 1;
  return { done, target, pct: Math.min(1, done / target), entries: es };
}
function memberWeek(memberId, ws) {
  const list = challengesForWeek(memberId, ws).map((c) => ({ c, ...progress(c, ws) }));
  if (!list.length) return { pct: null, list, done: 0, total: 0 };
  const pct = list.reduce((a, x) => a + x.pct, 0) / list.length;
  return { pct, list, done: list.filter((x) => x.pct >= 1).length, total: list.length };
}
function groupWeek(ws) {
  const rows = S.data.members.map((m) => ({ m, ...memberWeek(m.id, ws) })).filter((r) => r.pct !== null);
  const pct = rows.length ? rows.reduce((a, r) => a + r.pct, 0) / rows.length : 0;
  return { pct, rows };
}
function memberStreak(memberId) {
  let streak = 0;
  for (let i = 1; i <= 11; i++) { const w = memberWeek(memberId, addDays(thisMonday(), -7 * i)); if (w.pct !== null && w.pct >= 0.75) streak++; else break; }
  const cur = memberWeek(memberId, thisMonday());
  return streak + (cur.pct !== null && cur.pct >= 0.75 ? 1 : 0);
}
function memberStats(memberId) {
  const weeks = [];
  for (let i = 7; i >= 0; i--) { const ws = addDays(thisMonday(), -7 * i); weeks.push({ ws, ...memberWeek(memberId, ws) }); }
  const streak = memberStreak(memberId);
  const completed = weeks.reduce((a, w) => a + w.done, 0);
  const perfect = weeks.filter((w) => w.pct !== null && w.pct >= 1).length;
  const cheersSent = S.data.cheers.filter((c) => c.from_member === memberId).length;
  const loggedDaysThisWeek = new Set(S.data.entries.filter((e) => e.member_id === memberId && e.day >= ymd(thisMonday())).map((e) => e.day)).size;
  const hasChallenges = S.data.challenges.some((c) => c.member_id === memberId);
  const badges = [
    { icon: "🎯", name: "Primer reto", on: hasChallenges, how: "Crea tu primer reto" },
    { icon: "🔥", name: "Racha de 3", on: streak >= 3, how: "3 semanas seguidas por encima del 75%" },
    { icon: "🏆", name: "Semana perfecta", on: perfect >= 1, how: "Cumple el 100% una semana" },
    { icon: "📅", name: "Constante", on: loggedDaysThisWeek >= 5, how: "Apunta algo 5 días en una semana" },
    { icon: "📣", name: "Animadora", on: cheersSent >= 10, how: "Manda 10 ánimos a tus amigas" },
    { icon: "👑", name: "Reina", on: weeks.slice(0, -1).some((w) => isQueen(memberId, w.ws)), how: "Gana una semana en el grupo" },
  ];
  return { weeks, streak, completed, perfect, badges };
}
function isQueen(memberId, ws) {
  const { rows } = groupWeek(ws);
  if (!rows.length) return false;
  const best = Math.max(...rows.map((r) => r.pct));
  return best > 0 && rows.some((r) => r.m.id === memberId && r.pct === best);
}
const weekIndex = (ws) => Math.round(mondayOf(ws).getTime() / (7 * 86400000));
const commonFor = (ws) => GROUP_CHALLENGES[((weekIndex(ws) % GROUP_CHALLENGES.length) + GROUP_CHALLENGES.length) % GROUP_CHALLENGES.length];
const prendaFor = (ws) => PRENDAS[((weekIndex(ws) % PRENDAS.length) + PRENDAS.length) % PRENDAS.length];
const isOneWeek = (c) => c.archived_at && new Date(c.archived_at) > new Date();
function commonJoiners(ws) {
  const g = commonFor(ws);
  return challengesForWeekAll(ws).filter((c) => c.title === g.title).map((c) => member(c.member_id)).filter(Boolean);
}
function challengesForWeekAll(ws) {
  const end = ymd(addDays(ws, 6));
  return S.data.challenges.filter((c) => isoDay(c.created_at) <= end && (!c.archived_at || isoDay(c.archived_at) > end));
}
function describe(c) {
  return c.mode === "dias" ? `${fmt(c.target)} ${Number(c.target) === 1 ? "día" : "días"} a la semana` : `${fmt(c.target)} ${esc(c.unit)} a la semana`;
}

// ------------------------------------------------------------------ piezas visuales
function ring(p, size = 120, stroke = 12, color = "var(--pink)", inner = null) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, val = Math.max(0, Math.min(1, p || 0));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - val)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-label">${inner ?? `<b>${pctTxt(val)}</b>`}</div>
  </div>`;
}
const bar = (p, color = "var(--pink)") => `<div class="bar"><span style="width:${Math.round(Math.min(1, p || 0) * 100)}%;background:${color}"></span></div>`;
const avatar = (m, size = "") => `<span class="avatar ${size}" style="--c:${esc(m?.color || "#ccc")}">${esc(m?.emoji || "🙂")}</span>`;

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 2600);
}
function confetti() {
  const box = document.createElement("div"); box.className = "confetti";
  const bits = ["🎉", "✨", "💖", "⭐", "🥂", "🎊", "💐"];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement("span");
    s.textContent = bits[i % bits.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDelay = Math.random() * 0.6 + "s";
    s.style.fontSize = 18 + Math.random() * 22 + "px";
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

function sheet(html, onMount) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="sheet-close" aria-label="Cerrar">✕</button>${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add("no-scroll");
  requestAnimationFrame(() => wrap.classList.add("open"));
  const close = () => { wrap.classList.remove("open"); document.body.classList.remove("no-scroll"); setTimeout(() => wrap.remove(), 250); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  $(".sheet-close", wrap).onclick = close;
  onMount && onMount($(".sheet", wrap), close);
  return close;
}

async function act(fn, okMsg) {
  try { await fn(); await reload(); if (okMsg) toast(okMsg); }
  catch (err) { console.error(err); toast("Uy, algo ha fallado. Revisa tu conexión e inténtalo otra vez."); }
}

// ------------------------------------------------------------------ carga de datos
async function reload() {
  const since = ymd(addDays(thisMonday(), -7 * 12));
  S.data = await S.store.loadAll(since);
  render();
}
let reloadTimer = null;
const softReload = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(() => reload().catch(console.error), 400); };

// ================================================================== PANTALLAS
function render() {
  if (!LS.get("rt_tutorial_done")) return renderTutorial();
  if (!LS.get("rt_code_ok")) return renderCode();
  if (S.loading) { root.innerHTML = `<div class="center-screen"><div class="spinner"></div><p>Cargando…</p></div>`; return; }
  if (!me()) return renderWho();
  renderApp();
}

// ---------------------------------------------------------------- tutorial
const SLIDES = [
  { icon: "👋", title: `¡Bienvenida!</h1><p class="serif tut-name">${APP_NAME}</p><h1 class="hidden">`, text: "Aquí cada una se pone sus <b>retos personales</b>… y las amigas nos animamos (y nos vigilamos un poquito 😉)." },
  { icon: "🎯", title: "1. Ponte tus retos", text: "Andar 5 km, comer sano, leer un libro… Lo que tú quieras. <b>Te damos ideas</b> si no sabes cuál elegir." },
  { icon: "✅", title: "2. Apúntalo cuando lo hagas", text: "Toca el día o pulsa <b>«Apuntar»</b>. Así de fácil. La semana va de <b>lunes a domingo</b>." },
  { icon: "👯‍♀️", title: "3. Mira a tus amigas", text: "Ve cómo van las demás y <b>mándales ánimos</b> con un toque: 👏 ❤️ 🔥 💪" },
  { icon: "🥂", title: "4. El resumen del domingo", text: "Al final de la semana verás <b>quién lo ha conseguido</b>, el porcentaje del grupo y quién es la reina de la semana. 👑" },
];
function renderTutorial(step = 0) {
  const s = SLIDES[step], last = step === SLIDES.length - 1;
  root.innerHTML = `<div class="tutorial">
    <button class="link skip">Saltar</button>
    <div class="tut-card">
      <div class="tut-icon">${s.icon}</div>
      <h1 class="serif">${s.title}</h1>
      <p>${s.text}</p>
    </div>
    <div class="dots">${SLIDES.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div>
    <div class="tut-actions">
      ${step > 0 ? `<button class="btn ghost back">Atrás</button>` : ""}
      <button class="btn primary big next">${last ? "¡Empezar! ✨" : "Siguiente →"}</button>
    </div>
  </div>`;
  const finish = () => {
    LS.set("rt_tutorial_done", "1");
    if (LS.get("rt_code_ok") && S.loading) boot(); else render();
  };
  $(".skip").onclick = finish;
  $(".next").onclick = () => (last ? finish() : renderTutorial(step + 1));
  const b = $(".back"); if (b) b.onclick = () => renderTutorial(step - 1);
}

// ---------------------------------------------------------------- código de grupo
function renderCode() {
  root.innerHTML = `<div class="center-screen">
    <div class="brand-big"><span class="serif">${esc(APP_NAME)}</span><small>☕ retos entre amigas 🍸</small></div>
    <div class="card pad">
      <h2>Escribe la contraseña del grupo</h2>
      <p class="muted">Solo se pide esta vez. Te la habrá pasado una amiga.</p>
      <input class="input big" id="code" type="text" autocomplete="off" autocapitalize="none" placeholder="Contraseña" />
      <button class="btn primary big full" id="go">Entrar</button>
      ${IS_DEMO ? `<p class="demo-note">Modo de prueba: la contraseña es <b>amigas</b>.</p>` : ""}
    </div>
  </div>`;
  const go = async () => {
    const v = $("#code").value;
    if (!v.trim()) return;
    $("#go").disabled = true; $("#go").textContent = "Comprobando…";
    try {
      if (await S.store.checkCode(v)) { LS.set("rt_code_ok", "1"); await boot(); }
      else { toast("Esa contraseña no es. ¡Prueba otra vez!"); $("#go").disabled = false; $("#go").textContent = "Entrar"; }
    } catch (e) { console.error(e); toast("No puedo conectar. Revisa internet."); $("#go").disabled = false; $("#go").textContent = "Entrar"; }
  };
  $("#go").onclick = go;
  $("#code").onkeydown = (e) => { if (e.key === "Enter") go(); };
}

// ---------------------------------------------------------------- ¿quién eres?
function renderWho() {
  const ms = S.data.members;
  root.innerHTML = `<div class="who">
    <div class="brand-big"><span class="serif">${esc(APP_NAME)}</span><small>☕ retos entre amigas 🍸</small></div>
    <h1 class="serif center">¿Quién eres?</h1>
    <p class="muted center">Toca tu nombre</p>
    <div class="who-grid">
      ${ms.map((m) => `<button class="who-btn" data-id="${m.id}" style="--c:${esc(m.color)}"><span class="who-emoji">${esc(m.emoji)}</span><span>${esc(m.name)}</span></button>`).join("")}
      <button class="who-btn new" id="newMe"><span class="who-emoji">➕</span><span>Soy nueva</span></button>
    </div>
  </div>`;
  $$(".who-btn[data-id]").forEach((b) => (b.onclick = () => { S.me = b.dataset.id; LS.set("rt_me", S.me); S.tab = "home"; render(); }));
  $("#newMe").onclick = () => profileSheet(null);
}

function profileSheet(m) {
  const isNew = !m;
  const d = m ? { ...m } : { name: "", emoji: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: COLORS[S.data.members.length % COLORS.length], motto: "" };
  sheet(`<h2 class="serif">${isNew ? "¡Hola! Preséntate" : "Editar mi perfil"}</h2>
    <label class="lbl">Tu nombre</label>
    <input class="input big" id="pName" maxlength="20" value="${esc(d.name)}" placeholder="Ej: Carmen" />
    <label class="lbl">Elige tu dibujito</label>
    <div class="chips emojis" id="pEmoji">${AVATARS.map((e) => `<button class="chip ${e === d.emoji ? "on" : ""}" data-v="${e}">${e}</button>`).join("")}</div>
    <label class="lbl">Tu color</label>
    <div class="chips colors" id="pColor">${COLORS.map((c) => `<button class="swatch ${c === d.color ? "on" : ""}" data-v="${c}" style="background:${c}" aria-label="color"></button>`).join("")}</div>
    <label class="lbl">Tu frase o lema (opcional)</label>
    <input class="input" id="pMotto" maxlength="60" value="${esc(d.motto)}" placeholder="Ej: Este año, sí" />
    <button class="btn primary big full" id="pSave">${isNew ? "¡Entrar! ✨" : "Guardar"}</button>`,
  (el, close) => {
    $$("#pEmoji .chip", el).forEach((b) => (b.onclick = () => { d.emoji = b.dataset.v; $$("#pEmoji .chip", el).forEach((x) => x.classList.toggle("on", x === b)); }));
    $$("#pColor .swatch", el).forEach((b) => (b.onclick = () => { d.color = b.dataset.v; $$("#pColor .swatch", el).forEach((x) => x.classList.toggle("on", x === b)); }));
    $("#pSave", el).onclick = async () => {
      d.name = $("#pName", el).value.trim(); d.motto = $("#pMotto", el).value.trim();
      if (!d.name) return toast("Escribe tu nombre 😊");
      try {
        const saved = await S.store.saveMember(d);
        if (isNew) { S.me = saved.id; LS.set("rt_me", S.me); S.tab = "home"; }
        close(); await reload();
        toast(isNew ? `¡Bienvenida, ${d.name}! 🎉` : "Perfil guardado ✅");
      } catch (e) { console.error(e); toast("No se ha podido guardar. Revisa internet."); }
    };
  });
}

// ---------------------------------------------------------------- app principal
const TABS = [
  { id: "home", icon: "🏠", label: "Mi semana" },
  { id: "group", icon: "👯‍♀️", label: "Las chicas" },
  { id: "sofa", icon: "🛋️", label: "El sofá" },
  { id: "summary", icon: "🏆", label: "Resumen" },
  { id: "profile", icon: avatarIcon, label: "Mi perfil" },
];
function avatarIcon() { return esc(me()?.emoji || "🙂"); }

function renderApp() {
  const scrollY = window.scrollY;
  const prevTab = root.dataset.tab;
  root.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="serif">${esc(APP_NAME)}</span></div>
      ${IS_DEMO ? `<span class="demo-pill">DEMO</span>` : ""}
    </header>
    <main class="content">${{ home: viewHome, group: viewGroup, sofa: viewSofa, summary: viewSummary, profile: viewProfile }[S.tab]()}</main>
    <nav class="tabbar">
      ${TABS.map((t) => `<button class="tab ${S.tab === t.id ? "on" : ""}" data-tab="${t.id}"><span class="tab-ico">${typeof t.icon === "function" ? t.icon() : t.icon}${t.id === "sofa" && S.tab !== "sofa" && unreadCount() ? `<i class="dot-new">${unreadCount()}</i>` : ""}</span><span>${t.label}</span></button>`).join("")}
    </nav>`;
  root.dataset.tab = S.tab;
  $$(".tab").forEach((b) => (b.onclick = () => {
    S.tab = b.dataset.tab;
    if (S.tab === "summary") S.summaryOffset = 0;
    if (S.tab === "home") S.homeOffset = 0;
    render(); window.scrollTo(0, 0);
  }));
  if (S.tab === "sofa") LS.set("rt_seen_feed", new Date().toISOString());
  ({ home: bindHome, group: bindGroup, sofa: bindSofa, summary: bindSummary, profile: bindProfile })[S.tab]();
  if (prevTab === S.tab) window.scrollTo(0, scrollY);
}

// ---------------------------------------------------------------- MI SEMANA
function phraseOfDay() {
  const d = today(); const n = Math.floor(d.getTime() / 86400000) + (me()?.name.length || 0);
  return PHRASES[n % PHRASES.length];
}
function viewHome() {
  const m = me(), cur = thisMonday(), past = S.homeOffset === -1;
  const ws = past ? addDays(cur, -7) : cur;
  const wk = memberWeek(m.id, ws);
  const dow = (today().getDay() + 6) % 7, left = 6 - dow;
  const cheers = S.data.cheers.filter((c) => c.to_member === m.id && c.week_start === ymd(cur));
  const last = memberWeek(m.id, addDays(cur, -7));
  const common = commonFor(cur);
  const joiners = commonJoiners(cur);
  const joined = joiners.some((x) => x.id === m.id);
  return `
    <section class="hello">
      <h1 class="serif">¡Hola, ${esc(m.name)}! ${esc(m.emoji)}</h1>
      <p class="muted cap">${longDate(today())}</p>
    </section>
    ${past ? "" : `<div class="quote">“${esc(phraseOfDay())}”</div>`}
    ${!past && dow === 6 ? `<div class="banner gold">🥂 ¡Hoy se cierra la semana! Último empujón y apunta todo lo que hayas hecho.</div>` : ""}
    ${!past && dow <= 1 && last.pct !== null ? `<button class="banner pink go-summary">${weekVerdict(last.pct).emoji} La semana pasada hiciste el <b>${pctTxt(last.pct)}</b>. ${weekVerdict(last.pct).title} <u>Ver resumen →</u></button>` : ""}
    ${!past && wk.total ? `
    <section class="card week-card">
      ${ring(wk.pct, 116, 13, "var(--pink)")}
      <div>
        <h3>Tu semana</h3>
        <p><b>${wk.done} de ${wk.total}</b> retos cumplidos</p>
        <p class="muted small">${phraseForPct(wk.pct)}</p>
        <p class="muted small">${left === 0 ? "Hoy es el último día" : `Quedan ${left} ${left === 1 ? "día" : "días"}`}</p>
      </div>
    </section>` : ""}
    ${!past && cheers.length ? `<section class="cheers-in"><b>Te están animando:</b> ${cheers.slice(-8).map((c) => `<span class="cheer-chip">${esc(c.emoji)} ${esc(member(c.from_member)?.name || "")}</span>`).join("")}</section>` : ""}
    ${!past ? `
    <section class="card common ${joined ? "joined" : ""}">
      <div class="common-tag">🌟 Reto común de la semana</div>
      <div class="row"><span class="ch-emoji">${esc(common.emoji)}</span><div class="grow"><h3>${esc(common.title)}</h3><p class="muted small">${describe(common)} · solo esta semana</p></div></div>
      <div class="row between">
        <div class="joiners">${joiners.length ? joiners.map((x) => avatar(x, "sm")).join("") + `<small class="muted"> ${joiners.length === 1 ? "se ha apuntado" : "se han apuntado"}</small>` : `<small class="muted">¡Sé la primera en apuntarte!</small>`}</div>
        ${joined ? `<span class="badge-ok">¡Estás dentro! ✅</span>` : `<button class="btn primary join-common">¡Me apunto!</button>`}
      </div>
    </section>` : ""}
    <div class="seg">
      <button class="seg-btn ${past ? "" : "on"}" data-off="0">Esta semana</button>
      <button class="seg-btn ${past ? "on" : ""}" data-off="-1">Semana pasada</button>
    </div>
    ${past ? `<div class="banner soft">📝 Estás en la <b>semana pasada</b> (${shortRange(ws)}). ¿Se te olvidó apuntar algo? Puedes hacerlo aquí.</div>` : ""}
    <h2 class="section-title">${past ? "Mis retos de la semana pasada" : "Mis retos de esta semana"}</h2>
    ${wk.list.length ? wk.list.map((x) => challengeCard(x, ws)).join("") : past ? `<div class="card pad empty"><p>La semana pasada no tenías retos.</p></div>` : `
      <div class="card pad empty">
        <div class="big-emoji">🎯</div>
        <p><b>Aún no tienes retos.</b><br>¿Te ayudo a elegir alguno?</p>
      </div>`}
    ${past ? "" : `<button class="btn primary big full add-ch">＋ Añadir un reto</button>`}
    <div class="spacer"></div>`;
}
function challengeCard(x, ws) {
  const { c, done, target, pct } = x;
  const complete = pct >= 1;
  const todayStr = ymd(today());
  let body;
  if (c.mode === "dias") {
    const daysDone = new Set(x.entries.map((e) => e.day));
    body = `<div class="days">${DAY_LETTERS.map((L, i) => {
      const d = ymd(addDays(ws, i)); const fut = d > todayStr;
      return `<button class="day ${daysDone.has(d) ? "on" : ""} ${d === todayStr ? "today" : ""}" data-ch="${c.id}" data-day="${d}" ${fut ? "disabled" : ""} aria-label="${DAY_NAMES[i]}">${daysDone.has(d) ? "✓" : L}</button>`;
    }).join("")}</div>
    <p class="muted small">Toca los días que lo has hecho · llevas <b>${done} de ${fmt(target)}</b></p>`;
  } else {
    body = `${bar(pct, complete ? "var(--green)" : "var(--pink)")}
    <div class="row between"><p class="amount"><b>${fmt(done)}</b> de ${fmt(target)} ${esc(c.unit)}</p>
    <button class="btn primary log" data-ch="${c.id}">＋ Apuntar</button></div>`;
  }
  return `<article class="card ch ${complete ? "done" : ""}">
    <div class="ch-head">
      <span class="ch-emoji">${esc(c.emoji)}</span>
      <div class="grow"><h3>${esc(c.title)}</h3><p class="muted small">${describe(c)}${isOneWeek(c) ? " · 🌟 reto común" : ""}</p></div>
      ${complete ? `<span class="badge-ok">¡Hecho! 🎉</span>` : ""}
      <button class="icon-btn edit-ch" data-ch="${c.id}" aria-label="Editar reto">⋯</button>
    </div>
    ${body}
  </article>`;
}
function homeWeek() { return S.homeOffset === -1 ? addDays(thisMonday(), -7) : thisMonday(); }
function bindHome() {
  const ws = homeWeek();
  $$(".add-ch").forEach((b) => (b.onclick = () => challengeSheet(null)));
  $$(".go-summary").forEach((b) => (b.onclick = () => { S.tab = "summary"; S.summaryOffset = -1; render(); window.scrollTo(0, 0); }));
  $$(".seg-btn").forEach((b) => (b.onclick = () => { S.homeOffset = Number(b.dataset.off); render(); }));
  $$(".edit-ch").forEach((b) => (b.onclick = () => challengeSheet(S.data.challenges.find((c) => c.id === b.dataset.ch))));
  $$(".join-common").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    const g = commonFor(thisMonday());
    const ends = addDays(thisMonday(), 7); // se quita solo el lunes que viene
    await act(() => S.store.saveChallenge({ ...g, member_id: S.me, archived_at: ends.toISOString() }), "¡Te has apuntado al reto común! 🌟");
  }));
  $$(".day").forEach((b) => (b.onclick = async () => {
    const key = b.dataset.ch + b.dataset.day;
    if (S.busy.has(key)) return;
    S.busy.add(key);
    const c = S.data.challenges.find((x) => x.id === b.dataset.ch);
    const day = b.dataset.day;
    const before = progress(c, ws).pct;
    const existing = S.data.entries.filter((e) => e.challenge_id === c.id && e.day === day);
    b.classList.toggle("on"); // respuesta inmediata
    try {
      await act(async () => {
        if (existing.length) { for (const e of existing) await S.store.deleteEntry(e.id); }
        else await S.store.addEntry({ challenge_id: c.id, member_id: c.member_id, day, amount: 1 });
      });
    } finally { S.busy.delete(key); }
    celebrate(c, before, ws);
  }));
  $$(".log").forEach((b) => (b.onclick = () => logSheet(S.data.challenges.find((x) => x.id === b.dataset.ch), ws)));
}
function celebrate(c, before, ws) {
  const after = progress(c, ws).pct;
  if (before < 1 && after >= 1) {
    confetti(); toast(`¡Reto cumplido: ${c.title}! 🎉`);
    try { navigator.vibrate && navigator.vibrate([60, 40, 120]); } catch {}
    const wk = memberWeek(c.member_id, ws);
    if (wk.pct >= 1) setTimeout(() => { confetti(); toast("¡¡PLENO SEMANAL!! Eres una reina 👑"); }, 1800);
  }
}

function logSheet(c, ws = thisMonday()) {
  const todayStr = ymd(today());
  let amount = Number(c.target) >= 10 ? Math.round(Number(c.target) / 5) : 1;
  const lastDay = ymd(addDays(ws, 6));
  let day = todayStr <= lastDay ? todayStr : lastDay;
  const days = DAY_LETTERS.map((L, i) => ({ L, d: ymd(addDays(ws, i)), name: DAY_NAMES[i] })).filter((x) => x.d <= todayStr);
  const draw = (el) => {
    const p = progress(c, ws);
    $("#lgList", el).innerHTML = p.entries.length
      ? p.entries.sort((a, b) => a.day.localeCompare(b.day)).map((e) => `<li><span>${DAY_NAMES[(parseYmd(e.day).getDay() + 6) % 7]}: <b>${fmt(e.amount)} ${esc(c.unit)}</b></span><button class="icon-btn del" data-id="${e.id}" aria-label="Borrar">🗑️</button></li>`).join("")
      : `<li class="muted">Todavía no has apuntado nada esta semana.</li>`;
    $("#lgSum", el).innerHTML = `Llevas <b>${fmt(p.done)} de ${fmt(p.target)} ${esc(c.unit)}</b>`;
    $$(".del", el).forEach((b) => (b.onclick = async () => { await act(() => S.store.deleteEntry(b.dataset.id), "Borrado"); draw(el); }));
  };
  sheet(`<h2 class="serif">${esc(c.emoji)} ${esc(c.title)}</h2>
    <p id="lgSum" class="center"></p>
    <label class="lbl">¿Cuánto has hecho?</label>
    <div class="stepper big">
      <button class="btn round" id="lgMinus">−</button>
      <input class="input big center" id="lgAmt" inputmode="decimal" value="${fmt(amount)}" />
      <button class="btn round" id="lgPlus">＋</button>
    </div>
    <p class="center muted">${esc(c.unit)}</p>
    <label class="lbl">¿Qué día?</label>
    <div class="chips" id="lgDays">${days.map((x) => `<button class="chip day-chip ${x.d === day ? "on" : ""}" data-d="${x.d}">${x.d === todayStr ? "Hoy" : x.name}</button>`).join("")}</div>
    <button class="btn primary big full" id="lgSave">Apuntar ✅</button>
    <h4>Lo apuntado ${ymd(ws) === ymd(thisMonday()) ? "esta semana" : "esa semana"}</h4>
    <ul class="entry-list" id="lgList"></ul>`,
  (el, close) => {
    const amt = $("#lgAmt", el);
    const read = () => Number(String(amt.value).replace(",", ".")) || 0;
    $("#lgMinus", el).onclick = () => { amt.value = fmt(Math.max(0, read() - 1)); };
    $("#lgPlus", el).onclick = () => { amt.value = fmt(read() + 1); };
    $$(".day-chip", el).forEach((b) => (b.onclick = () => { day = b.dataset.d; $$(".day-chip", el).forEach((x) => x.classList.toggle("on", x === b)); }));
    $("#lgSave", el).onclick = async (ev) => {
      const v = read(); if (v <= 0) return toast("Pon una cantidad mayor que 0");
      if (v > 100000) return toast("Esa cantidad parece demasiado grande 😅");
      ev.currentTarget.disabled = true;
      const before = progress(c, ws).pct;
      await act(() => S.store.addEntry({ challenge_id: c.id, member_id: c.member_id, day, amount: v }), `¡Apuntado! +${fmt(v)} ${c.unit} 💪`);
      close(); celebrate(c, before, ws);
    };
    draw(el);
  });
}

function challengeSheet(existing) {
  const isNew = !existing;
  const d = existing ? { ...existing } : { emoji: "⭐", title: "", mode: "dias", target: 3, unit: "" };
  const form = () => `
    <label class="lbl">Elige un dibujito</label>
    <div class="chips emojis scroll-x" id="cEmoji">${CHALLENGE_EMOJIS.map((e) => `<button class="chip ${e === d.emoji ? "on" : ""}" data-v="${e}">${e}</button>`).join("")}</div>
    <label class="lbl">¿Cuál es tu reto?</label>
    <input class="input big" id="cTitle" maxlength="50" value="${esc(d.title)}" placeholder="Ej: Andar, Leer, Comer sano…" />
    <label class="lbl">¿Cómo lo quieres medir?</label>
    <div class="mode-pick">
      <button class="mode ${d.mode === "dias" ? "on" : ""}" data-m="dias"><span>📅</span><b>Por días</b><small>Marco los días que lo hago</small></button>
      <button class="mode ${d.mode === "cantidad" ? "on" : ""}" data-m="cantidad"><span>🔢</span><b>Por cantidad</b><small>Sumo km, páginas, veces…</small></button>
    </div>
    <div id="cTargetBox"></div>
    <div class="preview" id="cPreview"></div>
    <button class="btn primary big full" id="cSave">${isNew ? "Guardar reto ✨" : "Guardar cambios"}</button>
    ${isNew ? "" : `<button class="btn danger full" id="cArchive">Quitar este reto</button>`}`;
  const targetBox = () => d.mode === "dias"
    ? `<label class="lbl">¿Cuántos días a la semana?</label>
       <div class="chips days-pick">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<button class="chip num ${Number(d.target) === n ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div>`
    : `<label class="lbl">¿Cuánto a la semana?</label>
       <div class="stepper"><button class="btn round" id="tMinus">−</button><input class="input big center" id="cTarget" inputmode="decimal" value="${fmt(d.target)}"/><button class="btn round" id="tPlus">＋</button></div>
       <label class="lbl">¿En qué lo mides?</label>
       <input class="input" id="cUnit" maxlength="15" value="${esc(d.unit)}" placeholder="km, páginas, veces, libro…" />`;

  sheet(`<h2 class="serif">${isNew ? "Nuevo reto" : "Editar reto"}</h2>
    ${isNew ? `<div id="sugBox">
      <p class="muted">Elige una idea o escribe la tuya:</p>
      <button class="btn ghost big full" id="ownBtn">✏️ Escribir mi propio reto</button>
      ${SUGGESTIONS.map((g) => `<h4>${g.icon} ${g.cat}</h4><div class="sug-list">${g.items.map((it, i) => `<button class="sug" data-g="${g.cat}" data-i="${i}"><span>${it.emoji}</span><span class="grow">${esc(it.title)}<small>${it.mode === "dias" ? `${it.target} días/semana` : `${it.target} ${esc(it.unit)}/semana`}</small></span><span class="plus">＋</span></button>`).join("")}</div>`).join("")}
    </div>` : ""}
    <div id="formBox" ${isNew ? 'class="hidden"' : ""}>${form()}</div>`,
  (el, close) => {
    const readNum = (v) => Number(String(v).replace(",", ".")) || 0;
    const preview = () => {
      const t = ($("#cTitle", el).value || "…").trim();
      $("#cPreview", el).innerHTML = `Tu reto: <b>${esc(d.emoji)} ${esc(t)}</b> · ${d.mode === "dias" ? `${d.target} ${Number(d.target) === 1 ? "día" : "días"} a la semana` : `${fmt(d.target)} ${esc(d.unit)} a la semana`}`;
    };
    const bindTarget = () => {
      $("#cTargetBox", el).innerHTML = targetBox();
      $$(".days-pick .chip", el).forEach((b) => (b.onclick = () => { d.target = Number(b.dataset.n); $$(".days-pick .chip", el).forEach((x) => x.classList.toggle("on", x === b)); preview(); }));
      const ti = $("#cTarget", el);
      if (ti) {
        ti.oninput = () => { d.target = readNum(ti.value); preview(); };
        $("#tMinus", el).onclick = () => { d.target = Math.max(1, readNum(ti.value) - 1); ti.value = fmt(d.target); preview(); };
        $("#tPlus", el).onclick = () => { d.target = readNum(ti.value) + 1; ti.value = fmt(d.target); preview(); };
        $("#cUnit", el).oninput = (e) => { d.unit = e.target.value; preview(); };
      }
      preview();
    };
    const bindForm = () => {
      $$("#cEmoji .chip", el).forEach((b) => (b.onclick = () => { d.emoji = b.dataset.v; $$("#cEmoji .chip", el).forEach((x) => x.classList.toggle("on", x === b)); preview(); }));
      $("#cTitle", el).oninput = preview;
      $$(".mode", el).forEach((b) => (b.onclick = () => {
        if (d.mode === b.dataset.m) return;
        d.mode = b.dataset.m; $$(".mode", el).forEach((x) => x.classList.toggle("on", x === b));
        d.target = d.mode === "dias" ? Math.min(7, Math.max(1, Math.round(d.target) || 3)) : d.target || 1;
        bindTarget();
      }));
      bindTarget();
      $("#cSave", el).onclick = async () => {
        d.title = $("#cTitle", el).value.trim();
        if (!d.title) return toast("Escribe cuál es tu reto 😊");
        if (!(Number(d.target) > 0)) return toast("La cantidad tiene que ser mayor que 0");
        if (d.mode === "dias") { d.target = Math.min(7, Math.round(d.target)); d.unit = ""; }
        const row = { ...d, member_id: S.me };
        close();
        await act(() => S.store.saveChallenge(row), isNew ? "¡Reto añadido! A por él 💪" : "Reto actualizado ✅");
      };
      const arch = $("#cArchive", el);
      if (arch) arch.onclick = async () => {
        if (!arch.dataset.sure) { arch.dataset.sure = "1"; arch.textContent = "¿Seguro? Toca otra vez para quitarlo"; return; }
        close();
        await act(() => S.store.archiveChallenge(existing.id), "Reto quitado. Lo ya conseguido se queda en tu historial.");
      };
    };
    if (isNew) {
      const showForm = () => { $("#sugBox", el).classList.add("hidden"); $("#formBox", el).classList.remove("hidden"); $("#formBox", el).innerHTML = form(); bindForm(); el.scrollTop = 0; };
      $("#ownBtn", el).onclick = () => { showForm(); $("#cTitle", el).focus(); };
      $$(".sug", el).forEach((b) => (b.onclick = () => {
        const it = SUGGESTIONS.find((g) => g.cat === b.dataset.g).items[Number(b.dataset.i)];
        Object.assign(d, { emoji: it.emoji, title: it.title, mode: it.mode, target: it.target, unit: it.unit || "" });
        showForm();
      }));
    } else bindForm();
  });
}

// ---------------------------------------------------------------- LAS CHICAS
function viewGroup() {
  const ws = thisMonday(), g = groupWeek(ws);
  const rows = S.data.members.map((m) => ({ m, ...memberWeek(m.id, ws), streak: memberStreak(m.id) }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  return `
    <h1 class="serif">Las chicas</h1>
    <p class="muted">Semana del ${shortRange(ws)}</p>
    <section class="card group-card">
      ${ring(g.pct, 104, 12, "var(--purple)")}
      <div><h3>El grupo va al ${pctTxt(g.pct)}</h3><p class="muted small">${g.pct >= 0.7 ? "¡Esto va genial, chicas! 🥂" : g.pct >= 0.4 ? "Vamos bien, ¡pero se puede más! 💪" : "¡Hay que animarse un poco! Mandad ánimos 📣"}</p></div>
    </section>
    ${rows.map((r) => friendCard(r, ws)).join("")}
    <div class="spacer"></div>`;
}
function friendCard(r, ws) {
  const isMe = r.m.id === S.me;
  const cheers = S.data.cheers.filter((c) => c.to_member === r.m.id && c.week_start === ymd(ws));
  const counts = CHEER_EMOJIS.map((e) => [e, cheers.filter((c) => c.emoji === e).length]);
  return `<article class="card friend" style="--c:${esc(r.m.color)}">
    <div class="friend-head">
      ${avatar(r.m, "lg")}
      <div class="grow"><h3>${esc(r.m.name)} ${isMe ? `<small class="muted">(tú)</small>` : ""}</h3>${r.m.motto ? `<p class="muted small">“${esc(r.m.motto)}”</p>` : ""}${r.streak >= 2 ? `<span class="streak">🔥 ${r.streak} semanas seguidas</span>` : ""}</div>
      ${r.pct === null ? "" : ring(r.pct, 64, 8, r.m.color)}
    </div>
    ${r.list.length ? `<ul class="mini-list">${r.list.map((x) => `<li><span>${esc(x.c.emoji)}</span><span class="grow">${esc(x.c.title)}<small>${x.c.mode === "dias" ? `${x.done}/${fmt(x.target)} días` : `${fmt(x.done)}/${fmt(x.target)} ${esc(x.c.unit)}`}</small>${bar(x.pct, x.pct >= 1 ? "var(--green)" : r.m.color)}</span>${x.pct >= 1 ? "✅" : ""}</li>`).join("")}</ul>`
      : `<p class="muted small">Aún no tiene retos esta semana. ${isMe ? "" : "¡Anímala a ponerse uno! 😉"}</p>`}
    <div class="cheer-row">
      ${counts.map(([e, n]) => isMe
        ? `<span class="cheer-count">${e} ${n}</span>`
        : `<button class="cheer-btn" data-to="${r.m.id}" data-e="${e}">${e}${n ? ` <b>${n}</b>` : ""}</button>`).join("")}
      ${isMe ? `<span class="muted small">ánimos recibidos</span>` : ""}
    </div>
  </article>`;
}
const MAX_CHEERS_PER_DAY = 3; // del mismo emoji a la misma amiga
async function sendCheer(toId, emoji) {
  const to = member(toId);
  const todayStr = ymd(today());
  const sentToday = S.data.cheers.filter((c) => c.from_member === S.me && c.to_member === toId && c.emoji === emoji && isoDay(c.created_at) === todayStr).length;
  if (sentToday >= MAX_CHEERS_PER_DAY) return toast(`Ya le has mandado muchos ${emoji} hoy a ${to.name}. ¡Mañana más! 😉`);
  await act(() => S.store.addCheer({ from_member: S.me, to_member: toId, emoji, week_start: ymd(thisMonday()) }), `Has mandado ${emoji} a ${to.name}`);
}
function bindGroup() {
  $$(".cheer-btn").forEach((b) => (b.onclick = () => { b.classList.add("pop"); sendCheer(b.dataset.to, b.dataset.e); }));
}

// ---------------------------------------------------------------- EL SOFÁ (muro)
function unreadCount() {
  if (!S.data.messages) return 0;
  const seen = LS.get("rt_seen_feed") || "";
  return S.data.messages.filter((m) => m.member_id !== S.me && m.created_at > seen).length;
}
function feedItems() {
  const since = addDays(thisMonday(), -14).toISOString();
  const items = [];
  (S.data.messages || []).forEach((m) => items.push({ type: "msg", at: m.created_at, who: member(m.member_id), id: m.id, text: m.text }));
  // Retos cumplidos: el momento en que se llegó al objetivo
  for (const c of S.data.challenges) {
    for (const off of [0, -1, -2]) {
      const ws = addDays(thisMonday(), 7 * off);
      if (!challengesForWeek(c.member_id, ws).includes(c)) continue;
      const es = entriesFor(c, ws).sort((a, b) => a.created_at.localeCompare(b.created_at));
      let acc = 0; const days = new Set();
      for (const e of es) {
        if (c.mode === "dias") days.add(e.day); else acc += Number(e.amount);
        if ((c.mode === "dias" ? days.size : acc) >= Number(c.target)) { items.push({ type: "done", at: e.created_at, who: member(c.member_id), c }); break; }
      }
    }
    if (c.created_at >= since) items.push({ type: "new", at: c.created_at, who: member(c.member_id), c });
  }
  // Ánimos agrupados por persona y día
  const groups = {};
  S.data.cheers.filter((c) => c.created_at >= since).forEach((c) => {
    const k = c.from_member + c.to_member + isoDay(c.created_at);
    (groups[k] = groups[k] || { type: "cheer", at: c.created_at, who: member(c.from_member), to: member(c.to_member), emojis: [] }).emojis.push(c.emoji);
    if (c.created_at > groups[k].at) groups[k].at = c.created_at;
  });
  items.push(...Object.values(groups));
  return items.filter((i) => i.who && i.at >= since).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
}
function timeAgo(iso) {
  const d = new Date(iso), mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24 && isoDay(iso) === ymd(today())) return `hace ${h} h`;
  if (isoDay(iso) === ymd(addDays(today(), -1))) return `ayer, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function viewSofa() {
  if (S.data.messages === null) return `
    <h1 class="serif">El sofá 🛋️</h1>
    <div class="card pad"><p><b>El muro aún no está activado.</b></p><p class="muted">Quien gestione la app tiene que volver a ejecutar el archivo <code>supabase/schema.sql</code> en Supabase (es seguro, no borra nada).</p></div>`;
  const items = feedItems();
  return `
    <h1 class="serif">El sofá 🛋️</h1>
    <p class="muted">Aquí se cuenta todo: lo que conseguís, los ánimos y vuestros mensajes.</p>
    <section class="card pad composer">
      <textarea class="input" id="msgText" maxlength="500" rows="2" placeholder="Escribe algo al grupo…"></textarea>
      <div class="chips quick">${QUICK_MESSAGES.map((q) => `<button class="chip qm">${esc(q)}</button>`).join("")}</div>
      <button class="btn primary big full" id="msgSend">Enviar 💌</button>
    </section>
    ${items.length ? `<ul class="feed">${items.map(feedRow).join("")}</ul>` : `<div class="card pad empty"><div class="big-emoji">🛋️</div><p>Todavía no hay nada por aquí. ¡Rompe el hielo!</p></div>`}
    <div class="spacer"></div>`;
}
function feedRow(i) {
  const mine = i.who.id === S.me;
  let body = "", extra = "";
  if (i.type === "msg") {
    body = `<p class="bubble">${esc(i.text)}</p>`;
    if (mine) extra = `<button class="icon-btn del-msg" data-id="${i.id}" aria-label="Borrar mensaje">🗑️</button>`;
  } else if (i.type === "done") {
    body = `<p>¡Ha cumplido su reto <b>${esc(i.c.emoji)} ${esc(i.c.title)}</b>! 🎉</p>`;
    if (!mine) extra = `<button class="cheer-btn small clap" data-to="${i.who.id}">👏</button>`;
  } else if (i.type === "new") {
    body = `<p>Se ha puesto un reto nuevo: <b>${esc(i.c.emoji)} ${esc(i.c.title)}</b> (${describe(i.c)})</p>`;
  } else if (i.type === "cheer") {
    body = `<p>Ha mandado ${i.emojis.map(esc).join(" ")} a <b>${i.to ? esc(i.to.name) : "una amiga"}</b></p>`;
  }
  return `<li class="feed-item ${i.type} ${mine ? "mine" : ""}">
    ${avatar(i.who)}
    <div class="grow"><div class="feed-head"><b>${esc(i.who.name)}</b><small class="muted">${timeAgo(i.at)}</small></div>${body}</div>
    ${extra}
  </li>`;
}
function bindSofa() {
  const ta = $("#msgText"); if (!ta) return;
  $$(".qm").forEach((b) => (b.onclick = () => { ta.value = b.textContent; ta.focus(); }));
  $("#msgSend").onclick = async (ev) => {
    const text = ta.value.trim();
    if (!text) return toast("Escribe algo primero 😊");
    ev.currentTarget.disabled = true;
    await act(() => S.store.addMessage({ member_id: S.me, text }), "¡Mensaje enviado! 💌");
  };
  $$(".del-msg").forEach((b) => (b.onclick = async () => {
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "¿Borrar?"; b.classList.add("warn"); return; }
    await act(() => S.store.deleteMessage(b.dataset.id), "Mensaje borrado");
  }));
  $$(".clap").forEach((b) => (b.onclick = () => { b.classList.add("pop"); sendCheer(b.dataset.to, "👏"); }));
}

// ---------------------------------------------------------------- RESUMEN
function viewSummary() {
  const ws = addDays(thisMonday(), 7 * S.summaryOffset);
  const current = S.summaryOffset === 0;
  const g = groupWeek(ws);
  const v = groupVerdict(g.pct);
  const ranked = [...g.rows].sort((a, b) => b.pct - a.pct);
  const best = ranked.length ? ranked[0].pct : 0;
  const cheersWeek = S.data.cheers.filter((c) => c.week_start === ymd(ws));
  const byFrom = {}; cheersWeek.forEach((c) => (byFrom[c.from_member] = (byFrom[c.from_member] || 0) + 1));
  const topCheer = Object.entries(byFrom).sort((a, b) => b[1] - a[1])[0];
  const history = [];
  for (let i = 7; i >= 0; i--) { const w = addDays(thisMonday(), -7 * i); history.push({ w, p: groupWeek(w).pct, sel: i === -S.summaryOffset }); }
  const minOffset = -11;
  return `
    <h1 class="serif">Resumen semanal</h1>
    <div class="week-nav">
      <button class="btn round" id="wPrev" ${S.summaryOffset <= minOffset ? "disabled" : ""} aria-label="Semana anterior">‹</button>
      <div class="center"><b>${current ? "Esta semana" : S.summaryOffset === -1 ? "La semana pasada" : "Semana"}</b><br><span class="muted small">${shortRange(ws)}</span></div>
      <button class="btn round" id="wNext" ${current ? "disabled" : ""} aria-label="Semana siguiente">›</button>
    </div>
    ${current ? `<div class="banner soft">⏳ Semana en curso: el resultado final se cierra el <b>domingo a medianoche</b>.</div>` : ""}
    <section class="card verdict">
      <div class="verdict-emoji">${v.emoji}</div>
      <h2 class="serif">${current && g.pct < 0.7 && g.rows.length ? "Así vamos…" : v.title}</h2>
      ${ring(g.pct, 140, 14, "var(--purple)", `<b>${pctTxt(g.pct)}</b><small>del grupo</small>`)}
      <p>${current && g.pct < 0.7 && g.rows.length ? "Aún hay tiempo para remontar. ¡Ánimo, chicas!" : v.text}</p>
    </section>
    ${ranked.length ? `
    <h2 class="section-title">Clasificación</h2>
    <section class="card pad ranking">
      ${ranked.map((r, i) => {
        const wv = weekVerdict(r.pct);
        const queen = r.pct === best && best > 0;
        return `<div class="rank-row">
          <span class="pos">${queen ? "👑" : i + 1}</span>
          ${avatar(r.m)}
          <div class="grow"><div class="row between"><b>${esc(r.m.name)}</b><b>${pctTxt(r.pct)}</b></div>
            ${bar(r.pct, r.m.color)}
            <small class="muted">${r.done} de ${r.total} retos · ${current ? phraseShort(r.pct) : `${wv.emoji} ${wv.title}`}</small></div>
        </div>`;
      }).join("")}
    </section>
    <div class="awards">
      ${best > 0 ? `<div class="award"><span>👑</span><b>Reina de la semana</b><small>${ranked.filter((r) => r.pct === best).map((r) => esc(r.m.name)).join(" y ")}</small></div>` : ""}
      ${topCheer ? `<div class="award"><span>📣</span><b>La más animadora</b><small>${esc(member(topCheer[0])?.name || "")} (${topCheer[1]} ánimos)</small></div>` : ""}
      ${ranked.filter((r) => r.pct >= 1).length ? `<div class="award"><span>🏆</span><b>Pleno</b><small>${ranked.filter((r) => r.pct >= 1).map((r) => esc(r.m.name)).join(", ")}</small></div>` : ""}
    </div>
    ${prendaCard(ws, ranked, current)}
    <button class="btn whatsapp big full" id="shareWa">📲 Compartir en el grupo de WhatsApp</button>` : `<div class="card pad empty"><div class="big-emoji">🗓️</div><p>Esta semana no hay retos apuntados.</p></div>`}
    <h2 class="section-title">El grupo, semana a semana</h2>
    <section class="card pad">
      <div class="hist">${history.map((h) => `<div class="hcol ${h.sel ? "sel" : ""}"><small>${Math.round(h.p * 100)}</small><div class="hbar"><span style="height:${Math.round(h.p * 100)}%"></span></div><small>${h.w.getDate()}/${h.w.getMonth() + 1}</small></div>`).join("")}</div>
      <p class="muted small center">% conseguido por el grupo cada semana</p>
    </section>
    <div class="spacer"></div>`;
}
function prendaCard(ws, ranked, current) {
  const pr = prendaFor(ws);
  let who = "";
  if (ranked.length >= 2) {
    const val = pr.who === "first" ? ranked[0].pct : ranked[ranked.length - 1].pct;
    const names = ranked.filter((r) => r.pct === val).map((r) => esc(r.m.name)).join(" y ");
    who = current ? `Ahora mismo le tocaría a: <b>${names}</b>` : `Le toca a: <b>${names}</b> ${pr.who === "first" ? "🎉" : "😜"}`;
  }
  return `<section class="card prenda"><div class="prenda-emoji">🎲</div><div class="grow"><small class="muted">Prenda de la semana</small><p><b>${pr.emoji} ${esc(pr.text)}</b></p>${who ? `<p class="small">${who}</p>` : ""}</div></section>`;
}
function summaryText(ws) {
  const g = groupWeek(ws), v = groupVerdict(g.pct);
  const ranked = [...g.rows].sort((a, b) => b.pct - a.pct);
  const medals = ["🥇", "🥈", "🥉"];
  const pr = prendaFor(ws);
  const lines = [
    `🏆 *${APP_NAME}*`,
    `Semana del ${shortRange(ws)}`,
    "",
    `${v.emoji} *${v.title}* El grupo ha conseguido el *${pctTxt(g.pct)}* de los retos.`,
    "",
    ...ranked.map((r, i) => `${medals[i] || "▫️"} ${r.m.name}: ${pctTxt(r.pct)} (${r.done}/${r.total} retos)`),
    "",
    `🎲 Prenda: ${pr.emoji} ${pr.text}`,
    "",
    `👉 ${location.origin}${location.pathname}`,
  ];
  return lines.join("\n");
}
const phraseShort = (p) => (p >= 1 ? "¡pleno! 🎉" : p >= 0.75 ? "casi, casi 🔥" : p >= 0.5 ? "a mitad 💪" : p > 0 ? "arrancando 🌱" : "sin empezar ☕");
function bindSummary() {
  const p = $("#wPrev"), n = $("#wNext");
  if (p) p.onclick = () => { S.summaryOffset--; render(); };
  if (n) n.onclick = () => { S.summaryOffset = Math.min(0, S.summaryOffset + 1); render(); };
  const sh = $("#shareWa");
  if (sh) sh.onclick = () => {
    const ws = addDays(thisMonday(), 7 * S.summaryOffset);
    window.open("https://wa.me/?text=" + encodeURIComponent(summaryText(ws)), "_blank");
  };
}

// ---------------------------------------------------------------- PERFIL
function viewProfile() {
  const m = me(), st = memberStats(m.id);
  const archived = S.data.challenges.filter((c) => c.member_id === m.id && c.archived_at && !isOneWeek(c));
  return `
    <section class="profile-head" style="--c:${esc(m.color)}">
      ${avatar(m, "xl")}
      <h1 class="serif">${esc(m.name)}</h1>
      ${m.motto ? `<p class="muted">“${esc(m.motto)}”</p>` : ""}
      <button class="btn ghost" id="editMe">✏️ Editar mi perfil</button>
    </section>
    <div class="stats">
      <div class="stat"><b>${st.streak}</b><small>🔥 semanas<br>seguidas</small></div>
      <div class="stat"><b>${st.completed}</b><small>✅ retos<br>cumplidos</small></div>
      <div class="stat"><b>${st.perfect}</b><small>🏆 semanas<br>perfectas</small></div>
    </div>
    <h2 class="section-title">Mis últimas 8 semanas</h2>
    <section class="card pad">
      <div class="hist">${st.weeks.map((w, i) => `<div class="hcol ${i === st.weeks.length - 1 ? "sel" : ""}"><small>${w.pct === null ? "–" : Math.round(w.pct * 100)}</small><div class="hbar"><span style="height:${Math.round((w.pct || 0) * 100)}%;background:${esc(m.color)}"></span></div><small>${w.ws.getDate()}/${w.ws.getMonth() + 1}</small></div>`).join("")}</div>
    </section>
    <h2 class="section-title">Mis medallas</h2>
    <div class="badges">${st.badges.map((b) => `<div class="medal ${b.on ? "on" : ""}"><span>${b.icon}</span><b>${b.name}</b><small>${b.on ? "¡Conseguida!" : b.how}</small></div>`).join("")}</div>
    ${archived.length ? `<h2 class="section-title">Retos que ya quité</h2><section class="card pad"><ul class="plain">${archived.map((c) => `<li>${esc(c.emoji)} ${esc(c.title)} <small class="muted">· ${describe(c)}</small></li>`).join("")}</ul></section>` : ""}
    <h2 class="section-title">Ayuda</h2>
    <div class="menu">
      <button class="menu-item" id="installBtn">📱 Ponerla en la pantalla del móvil</button>
      <button class="menu-item" id="remindBtn">⏰ Ponerme un recordatorio diario</button>
      <button class="menu-item row between" id="bigBtn"><span>🔠 Letra más grande</span><span class="switch ${LS.get("rt_big") ? "on" : ""}"><i></i></span></button>
      <button class="menu-item" id="tutBtn">📖 Ver otra vez el tutorial</button>
      <button class="menu-item" id="switchBtn">🔄 No soy ${esc(m.name)} (cambiar de persona)</button>
    </div>
    <div class="spacer"></div>`;
}
function bindProfile() {
  $("#editMe").onclick = () => profileSheet(me());
  $("#tutBtn").onclick = () => { LS.del("rt_tutorial_done"); render(); };
  $("#switchBtn").onclick = () => { S.me = null; LS.del("rt_me"); render(); };
  $("#installBtn").onclick = installSheet;
  $("#remindBtn").onclick = reminderSheet;
  $("#bigBtn").onclick = () => {
    const on = !LS.get("rt_big");
    if (on) LS.set("rt_big", "1"); else LS.del("rt_big");
    document.documentElement.classList.toggle("big-text", on);
    render();
  };
}

function reminderSheet() {
  const hours = [["0900", "9:00", "Por la mañana"], ["1300", "13:00", "A mediodía"], ["1900", "19:00", "Por la tarde"], ["2100", "21:00", "Después de cenar"], ["2200", "22:00", "Antes de dormir"]];
  sheet(`<h2 class="serif">Recordatorio diario ⏰</h2>
    <p>Elige a qué hora quieres que tu móvil te avise cada día para apuntar tus retos. Se añadirá a tu <b>calendario</b>.</p>
    <div class="menu">${hours.map(([f, h, t]) => `<a class="menu-item row between" href="recordatorios/recordatorio-${f}.ics" target="_blank" rel="noopener"><span><b>${h}</b> · ${t}</span><span>＋</span></a>`).join("")}</div>
    <p class="muted small">Al tocar una hora, el móvil te preguntará si quieres añadir el evento al calendario: dile que <b>sí</b>. Para quitarlo, bórralo desde la app de Calendario.</p>`);
}

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; });
function installSheet() {
  sheet(`<h2 class="serif">Ponla en tu móvil 📱</h2>
    <p>Así tendrás un icono como si fuera una app, sin instalar nada.</p>
    ${deferredInstall ? `<button class="btn primary big full" id="doInstall">Instalar ahora</button>` : ""}
    <div class="howto"><h4>🍎 En iPhone (Safari)</h4>
      <ol><li>Abre el enlace en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> (el cuadrado con la flecha ⬆️).</li><li>Baja y toca <b>«Añadir a pantalla de inicio»</b>.</li><li>Pulsa <b>«Añadir»</b>. ¡Listo!</li></ol></div>
    <div class="howto"><h4>🤖 En Android (Chrome)</h4>
      <ol><li>Abre el enlace en <b>Chrome</b>.</li><li>Toca los <b>tres puntitos ⋮</b> de arriba a la derecha.</li><li>Toca <b>«Añadir a pantalla de inicio»</b> o <b>«Instalar aplicación»</b>.</li><li>Confirma. ¡Listo!</li></ol></div>`,
  (el, close) => {
    const b = $("#doInstall", el);
    if (b) b.onclick = async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; close(); };
  });
}

// ------------------------------------------------------------------ arranque
async function boot() {
  S.loading = true; render();
  if (!LS.get("rt_tutorial_done") || !LS.get("rt_code_ok")) return;
  try {
    await reload();
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="center-screen"><div class="big-emoji">😕</div><h2>No puedo conectar</h2><p class="muted">Revisa tu conexión a internet${IS_DEMO ? "" : " o la configuración de Supabase (js/config.js)"}.</p><button class="btn primary big" onclick="location.reload()">Reintentar</button></div>`;
    return;
  }
  S.loading = false; render();
}

(async () => {
  S.store = await createStore().catch((e) => { console.error(e); return null; });
  if (!S.store) { root.innerHTML = `<div class="center-screen"><div class="big-emoji">😕</div><h2>No puedo conectar</h2><p class="muted">Revisa tu conexión a internet.</p><button class="btn primary big" onclick="location.reload()">Reintentar</button></div>`; return; }
  S.store.subscribe(softReload);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.loading) softReload(); });
  if (LS.get("rt_tutorial_done") && LS.get("rt_code_ok")) await boot();
  else render();
})();


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
