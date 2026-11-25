create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  type text not null check (type in ('checking', 'savings', 'cash', 'credit')),
  opening_balance numeric(14, 2) not null default 0,
  color text not null default '#58a88d',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  kind text not null check (kind in ('income', 'expense')),
  color text not null default '#58a88d',
  icon text not null default '◉',
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name, kind)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(14, 2) not null check (amount > 0),
  description text not null check (char_length(trim(description)) between 1 and 160),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_account_owner
    foreign key (account_id, user_id) references public.accounts(id, user_id) on delete cascade,
  constraint transactions_category_owner
    foreign key (category_id, user_id) references public.categories(id, user_id) on delete set null (category_id)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  year integer not null check (year between 2000 and 2200),
  month integer not null check (month between 1 and 12),
  amount numeric(14, 2) not null check (amount > 0),
  alert_threshold integer not null default 80 check (alert_threshold between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_category_owner
    foreign key (category_id, user_id) references public.categories(id, user_id) on delete cascade,
  unique (user_id, category_id, year, month)
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, occurred_on desc);
create index if not exists transactions_user_account_idx
  on public.transactions (user_id, account_id);
create index if not exists budgets_user_period_idx
  on public.budgets (user_id, year, month);

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();
drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at before update on public.budgets
for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "Users manage own accounts" on public.accounts;
create policy "Users manage own accounts" on public.accounts
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own categories" on public.categories;
create policy "Users manage own categories" on public.categories
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own budgets" on public.budgets;
create policy "Users manage own budgets" on public.budgets
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on
  public.accounts, public.categories, public.transactions, public.budgets
to authenticated;
