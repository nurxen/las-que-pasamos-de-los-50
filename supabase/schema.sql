-- =====================================================================
--  LAS RETADORAS · Base de datos para Supabase
--  Cómo usarlo: Supabase > tu proyecto > SQL Editor > New query >
--  pega TODO este archivo > pulsa "Run".
--  Se puede volver a ejecutar sin miedo (por ejemplo, al actualizar la app):
--  no borra nada ni cambia la contraseña.
-- =====================================================================


-- Las amigas del grupo
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text not null default '🌸',
  color       text not null default '#E8579B',
  motto       text not null default '',
  created_at  timestamptz not null default now()
);

-- Los retos de cada una (se repiten cada semana hasta que se archivan)
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  title       text not null,
  emoji       text not null default '⭐',
  mode        text not null default 'dias' check (mode in ('dias','cantidad')),
  target      numeric not null default 1 check (target > 0),
  unit        text not null default '',
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- Lo que cada una va apuntando (un registro por día / cantidad)
create table if not exists public.entries (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  day          date not null,
  amount       numeric not null default 1,
  created_at   timestamptz not null default now()
);
create index if not exists entries_day_idx on public.entries(day);

-- Ánimos que se mandan entre amigas (👏 ❤️ 🔥 💪)
create table if not exists public.cheers (
  id          uuid primary key default gen_random_uuid(),
  from_member uuid not null references public.members(id) on delete cascade,
  to_member   uuid not null references public.members(id) on delete cascade,
  emoji       text not null,
  week_start  date not null,
  created_at  timestamptz not null default now()
);

-- Mensajes del muro "El sofá"
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages(created_at);

-- Ajustes privados (el código del grupo). Nadie puede leer esta tabla desde la app.
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

-- 👇👇 CAMBIA AQUÍ LA CONTRASEÑA DEL GRUPO (lo que se pide la primera vez) 👇👇
insert into public.app_settings(key, value) values ('group_code', 'amigas')
on conflict (key) do nothing;
-- Para cambiarla más adelante, ejecuta solo esta línea (con tu palabra):
--   update public.app_settings set value = 'nuevacontraseña' where key = 'group_code';

-- Comprueba el código sin revelar cuál es
create or replace function public.check_group_code(code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_settings
    where key = 'group_code' and lower(trim(value)) = lower(trim(code))
  );
$$;
grant execute on function public.check_group_code(text) to anon, authenticated;

-- Permisos: la app (clave pública) puede leer y escribir retos, registros, etc.
alter table public.members      enable row level security;
alter table public.challenges   enable row level security;
alter table public.entries      enable row level security;
alter table public.cheers       enable row level security;
alter table public.messages     enable row level security;
alter table public.app_settings enable row level security; -- sin políticas = privada

drop policy if exists "grupo" on public.members;
drop policy if exists "grupo" on public.challenges;
drop policy if exists "grupo" on public.entries;
drop policy if exists "grupo" on public.cheers;
drop policy if exists "grupo" on public.messages;
create policy "grupo" on public.members    for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.challenges for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.entries    for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.cheers     for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.messages   for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.members, public.challenges, public.entries, public.cheers, public.messages to anon, authenticated;

-- Tiempo real: cuando una amiga apunta algo, a las demás se les actualiza solo
do $$
declare t text;
begin
  foreach t in array array['members','challenges','entries','cheers','messages'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
--  RESUMEN AUTOMÁTICO DE LA SEMANA
--  Cada domingo a medianoche se publica en "El sofá" el resumen con la
--  ganadora. Si por lo que sea no se publica, lo hace la app sola la
--  primera vez que alguien la abre el lunes.
-- =====================================================================

-- Mensajes del sistema (sin autora) y una marca para no repetir el resumen
alter table public.messages alter column member_id drop not null;
alter table public.messages add column if not exists kind text not null default 'user';
alter table public.messages add column if not exists week_start date;
alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages add constraint messages_text_check check (char_length(text) between 1 and 2000);
create unique index if not exists messages_one_summary_per_week on public.messages(week_start) where kind = 'summary';

-- Resultados de una semana (misma cuenta que hace la app)
create or replace function public.week_results(ws date)
returns table(member_id uuid, name text, emoji text, pct numeric, done int, total int)
language sql stable security definer set search_path = public as $$
  with ch as (
    select c.*, m.name as mname, m.emoji as memoji
    from challenges c join members m on m.id = c.member_id
    where (c.created_at at time zone 'Europe/Madrid')::date <= ws + 6
      and (c.archived_at is null or (c.archived_at at time zone 'Europe/Madrid')::date > ws + 6)
  ), prog as (
    select ch.member_id, ch.mname, ch.memoji,
      least(1, coalesce(case when ch.mode = 'dias'
        then (select count(distinct e.day) from entries e where e.challenge_id = ch.id and e.day between ws and ws + 6)
        else (select sum(e.amount) from entries e where e.challenge_id = ch.id and e.day between ws and ws + 6) end, 0) / ch.target) as p
    from ch
  )
  select member_id, mname, memoji, avg(p), (count(*) filter (where p >= 1))::int, count(*)::int
  from prog group by member_id, mname, memoji;
$$;

-- Escribe el resumen de la semana pasada en "El sofá" (no hace nada si ya está)
create or replace function public.post_weekly_summary()
returns text language plpgsql security definer set search_path = public as $$
declare
  ws date := (date_trunc('week', now() at time zone 'Europe/Madrid'))::date - 7;
  meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  rango text; grp numeric; best numeric; winners text; podium text := ''; verdict text; r record; i int := 0; msg text;
begin
  if exists (select 1 from messages where kind = 'summary' and week_start = ws) then return 'ya publicado'; end if;
  select avg(pct), max(pct) into grp, best from week_results(ws);
  if grp is null then return 'sin retos esa semana'; end if;

  rango := extract(day from ws)::int || case when extract(month from ws) = extract(month from ws + 6) then '' else ' de ' || meses[extract(month from ws)::int] end
        || ' al ' || extract(day from ws + 6)::int || ' de ' || meses[extract(month from ws + 6)::int];
  select string_agg(name, ' y ' order by name) into winners from week_results(ws) where pct = best and best > 0;
  for r in select * from week_results(ws) order by pct desc, done desc, name loop
    i := i + 1;
    podium := podium || E'\n' || case i when 1 then '🥇' when 2 then '🥈' when 3 then '🥉' else '▫️' end
           || ' ' || r.name || ': ' || round(r.pct * 100) || '% (' || r.done || '/' || r.total || ' retos)';
  end loop;
  verdict := case when grp >= 0.9 then '¡Lo habéis petado, chicas! 🥂'
                  when grp >= 0.7 then '¡Lo habéis conseguido! 🎉'
                  when grp >= 0.5 then '¡Vamos por buen camino! 💪'
                  else 'Semana flojita… ¡la próxima, a por todas! ☕' end;
  msg := '🏆 Resumen de la semana del ' || rango || E'\n\n'
      || verdict || ' El grupo ha conseguido el ' || round(grp * 100) || '% de los retos.' || E'\n\n'
      || coalesce('👑 ' || case when winners like '% y %' then 'Ganadoras: ' else 'Ganadora: ' end || winners || ' con el ' || round(best * 100) || '%' || E'\n', '')
      || podium || E'\n\n' || '¡Nueva semana, nuevos retos! 💪';
  insert into messages(member_id, text, kind, week_start) values (null, msg, 'summary', ws);
  return 'publicado';
exception when unique_violation then return 'ya publicado';
end $$;
grant execute on function public.post_weekly_summary() to anon, authenticated;

-- Programarlo: domingo 23:05 UTC = lunes 00:05 en España (01:05 en verano)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('resumen-semanal', '5 23 * * 0', 'select public.post_weekly_summary()');
exception when others then
  raise notice 'No se pudo activar pg_cron (%). No pasa nada: la app publicará el resumen al abrirla el lunes.', sqlerrm;
end $$;
