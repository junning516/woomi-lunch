-- ─────────────────────────────────────────────────────────────
--  우미 점메추 — Supabase 테이블 만들기
--  Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
--  (여러 번 실행해도 안전합니다)
-- ─────────────────────────────────────────────────────────────

-- 1) 파일: 날짜 + 팀 하나당 한 줄, 메뉴 후보를 담음
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  team        text not null check (char_length(team) between 1 and 30),
  menus       jsonb not null default '[]'::jsonb,   -- [{"name":"김치찌개","on":true}, ...]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (date, team)
);

-- 2) 게임 기록: 한 판 돌릴 때마다 한 줄
create table if not exists public.spins (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  mode        text not null check (mode in ('roulette','slot','pinball')),
  result      text not null,
  candidates  jsonb not null default '[]'::jsonb,   -- 그 판의 후보 목록
  created_at  timestamptz not null default now()
);
create index if not exists spins_room_created_idx on public.spins (room_id, created_at desc);
create index if not exists spins_created_idx on public.spins (created_at desc);

-- 2-1) 후보 목록: "개발영업팀 추천 맛집" 같은 메뉴 묶음, 파일에서 불러와 씀
create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 1 and 30),
  items       jsonb not null default '[]'::jsonb,   -- ["을지로 칼국수집", "부대찌개집", ...]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3) 접근 규칙: 링크를 가진 사람은 파일을 보고·만들고·고치고·지울 수 있음
--    게임 기록은 보기·추가만 가능 (수정·개별 삭제 불가, 파일을 지우면 함께 삭제)
alter table public.rooms enable row level security;
alter table public.spins enable row level security;
alter table public.lists enable row level security;

drop policy if exists lists_all    on public.lists;
create policy lists_all    on public.lists for all    to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.lists to anon, authenticated;

drop policy if exists rooms_all    on public.rooms;
drop policy if exists spins_read   on public.spins;
drop policy if exists spins_insert on public.spins;

create policy rooms_all    on public.rooms for all    to anon, authenticated using (true) with check (true);
create policy spins_read   on public.spins for select to anon, authenticated using (true);
create policy spins_insert on public.spins for insert to anon, authenticated with check (true);

grant select, insert, update, delete on public.rooms to anon, authenticated;
grant select, insert                 on public.spins to anon, authenticated;
