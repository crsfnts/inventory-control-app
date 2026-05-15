-- Inventory Control App - Supabase setup
-- Paste this entire file into Supabase > SQL Editor > New query > Run.
-- This version stores NO PHI. Do not enter patient names, DOBs, MRNs, RX numbers, or other identifiers.

create extension if not exists pgcrypto;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  category text default 'General',
  active boolean not null default true,
  unique(name)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  active boolean not null default true,
  unique(name)
);

create table if not exists public.par_levels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_id uuid not null references public.items(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  par_level numeric not null default 0 check (par_level >= 0),
  target_level numeric not null default 0 check (target_level >= 0),
  unique(item_id, location_id)
);

create table if not exists public.monthly_counts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  count_month date not null,
  item_id uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  system_balance numeric not null,
  physical_count numeric not null check (physical_count >= 0),
  difference numeric not null,
  notes text
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid(),
  item_id uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  action text not null check (action in ('OPENING','ADD','REMOVE','TRANSFER_IN','TRANSFER_OUT','CORRECTION','MONTHLY_ADJUSTMENT')),
  quantity numeric not null,
  reason text,
  notes text,
  related_transaction_id uuid references public.transactions(id),
  monthly_count_id uuid references public.monthly_counts(id)
);

create index if not exists idx_transactions_item_location on public.transactions(item_id, location_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);
create index if not exists idx_monthly_counts_month on public.monthly_counts(count_month desc);

alter table public.items enable row level security;
alter table public.locations enable row level security;
alter table public.par_levels enable row level security;
alter table public.transactions enable row level security;
alter table public.monthly_counts enable row level security;

-- Starter policies: any logged-in user can use the app.
-- For a stricter workplace version, replace these with role-based policies later.
drop policy if exists "Authenticated users can read items" on public.items;
create policy "Authenticated users can read items" on public.items for select to authenticated using (true);
drop policy if exists "Authenticated users can manage items" on public.items;
create policy "Authenticated users can manage items" on public.items for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read locations" on public.locations;
create policy "Authenticated users can read locations" on public.locations for select to authenticated using (true);
drop policy if exists "Authenticated users can manage locations" on public.locations;
create policy "Authenticated users can manage locations" on public.locations for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read par levels" on public.par_levels;
create policy "Authenticated users can read par levels" on public.par_levels for select to authenticated using (true);
drop policy if exists "Authenticated users can manage par levels" on public.par_levels;
create policy "Authenticated users can manage par levels" on public.par_levels for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can read transactions" on public.transactions;
create policy "Authenticated users can read transactions" on public.transactions for select to authenticated using (true);
drop policy if exists "Authenticated users can insert transactions" on public.transactions;
create policy "Authenticated users can insert transactions" on public.transactions for insert to authenticated with check (auth.uid() = user_id);
-- No update/delete policy on transactions. Keep the audit trail append-only from the app.

drop policy if exists "Authenticated users can read monthly counts" on public.monthly_counts;
create policy "Authenticated users can read monthly counts" on public.monthly_counts for select to authenticated using (true);
drop policy if exists "Authenticated users can insert monthly counts" on public.monthly_counts;
create policy "Authenticated users can insert monthly counts" on public.monthly_counts for insert to authenticated with check (auth.uid() = user_id);
-- No update/delete policy on monthly counts.

-- Optional starter data. Delete or edit these after testing.
insert into public.items (name, category)
values
  ('Acetaminophen 500 mg Tablet', 'Medication'),
  ('Ibuprofen 200 mg Tablet', 'Medication'),
  ('Amoxicillin 500 mg Capsule', 'Medication')
on conflict (name) do nothing;

insert into public.locations (name)
values
  ('Main Pharmacy - Shelf A1'),
  ('Main Pharmacy - Shelf B2'),
  ('Clinic Supply Cabinet')
on conflict (name) do nothing;
