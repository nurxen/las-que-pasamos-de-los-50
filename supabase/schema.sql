-- =====================================================================
--  LAS RETADORAS · Base de datos para Supabase
--  Cómo usarlo: Supabase > tu proyecto > SQL Editor > New query >
--  pega TODO este archivo > pulsa "Run". Solo hay que hacerlo una vez.
-- =====================================================================

create extension if not exists pgcrypto;

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

-- Ajustes privados (el código del grupo). Nadie puede leer esta tabla desde la app.
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);

-- 👇👇 CAMBIA AQUÍ EL CÓDIGO DEL GRUPO (lo que se pide la primera vez) 👇👇
insert into public.app_settings(key, value) values ('group_code', 'amigas')
on conflict (key) do update set value = excluded.value;

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
alter table public.app_settings enable row level security; -- sin políticas = privada

drop policy if exists "grupo" on public.members;
drop policy if exists "grupo" on public.challenges;
drop policy if exists "grupo" on public.entries;
drop policy if exists "grupo" on public.cheers;
create policy "grupo" on public.members    for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.challenges for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.entries    for all to anon, authenticated using (true) with check (true);
create policy "grupo" on public.cheers     for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.members, public.challenges, public.entries, public.cheers to anon, authenticated;

-- Tiempo real: cuando una amiga apunta algo, a las demás se les actualiza solo
do $$
declare t text;
begin
  foreach t in array array['members','challenges','entries','cheers'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
