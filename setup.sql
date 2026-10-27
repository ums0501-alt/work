-- Supabase SQL Editor에서 한 번 실행합니다.
create table if not exists public.wx_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  region text not null check (region in ('세종', '대전', '태안', '보령')),
  kind text not null check (kind in ('야외', '고소', '실내')),
  owner text not null check (btrim(owner) <> ''),
  created_at timestamptz not null default now()
);

alter table public.wx_tasks enable row level security;

revoke all on table public.wx_tasks from anon, authenticated;
grant usage on schema public to anon;
grant select, insert on table public.wx_tasks to anon;

drop policy if exists "Public can read wx_tasks" on public.wx_tasks;
create policy "Public can read wx_tasks"
  on public.wx_tasks for select to anon
  using (true);

drop policy if exists "Public can add wx_tasks" on public.wx_tasks;
create policy "Public can add wx_tasks"
  on public.wx_tasks for insert to anon
  with check (true);

insert into public.wx_tasks (id, title, region, kind, owner) values
  ('00000000-0000-4000-8000-000000000001', '다중이용시설 안전점검', '세종', '야외', '김안전'),
  ('00000000-0000-4000-8000-000000000002', '시민 안전체험 행사 운영', '보령', '야외', '이행사'),
  ('00000000-0000-4000-8000-000000000003', '옥상 태양광 설비 점검', '태안', '고소', '박설비'),
  ('00000000-0000-4000-8000-000000000004', '하천 수위계 확인', '대전', '야외', '최현장'),
  ('00000000-0000-4000-8000-000000000005', '청사 외벽 간판 보수', '세종', '고소', '정시설'),
  ('00000000-0000-4000-8000-000000000006', '비상연락 훈련', '대전', '실내', '한상황')
on conflict (id) do nothing;
