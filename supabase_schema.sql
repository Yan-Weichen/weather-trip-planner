-- =============================================
-- 旅遊行程規劃師 — Supabase 資料庫 Schema
-- 在 Supabase Dashboard → SQL Editor 執行此檔案
-- =============================================

-- 1. 建立 trips 表
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  destination text not null default '',
  start_date date,
  end_date date,
  preferences text[] default '{}',
  plan_data jsonb not null default '{}',
  total_budget_min int default 0,
  total_budget_max int default 0,
  share_id text unique,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 建立索引
create index if not exists idx_trips_user_id on trips(user_id);
create index if not exists idx_trips_share_id on trips(share_id);

-- 3. 啟用 Row Level Security
alter table trips enable row level security;

-- 4. RLS 政策：使用者只能操作自己的行程
create policy "Users can select own trips"
  on trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on trips for update
  using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on trips for delete
  using (auth.uid() = user_id);

-- 5. RLS 政策：任何人可讀取公開分享的行程（唯讀）
create policy "Anyone can view public shared trips"
  on trips for select
  using (is_public = true);

-- 6. 自動更新 updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trips_updated_at
  before update on trips
  for each row
  execute function update_updated_at();
