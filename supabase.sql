-- Loan Ledger / Supabase database setup
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.loans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  principal numeric(15,2) not null check (principal >= 0),
  rate numeric(8,4) not null check (rate >= 0),
  rate_unit text not null check (rate_unit in ('monthly','yearly')),
  start_date date not null,
  update_date date not null,
  note text not null default '' check (char_length(note) <= 120),
  created_at timestamptz not null default now()
);

alter table public.loans enable row level security;

drop policy if exists "Users can view own loans" on public.loans;
drop policy if exists "Users can insert own loans" on public.loans;
drop policy if exists "Users can update own loans" on public.loans;
drop policy if exists "Users can delete own loans" on public.loans;

create policy "Users can view own loans"
  on public.loans for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own loans"
  on public.loans for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own loans"
  on public.loans for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own loans"
  on public.loans for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists loans_user_id_idx on public.loans(user_id);
