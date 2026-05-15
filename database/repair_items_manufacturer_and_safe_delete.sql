-- Emergency repair migration for Inventory Control App.
-- Run this script in Supabase SQL Editor, then sign out of the app and sign back in.
-- If the manufacturer/schema-cache error still appears, run:
--   NOTIFY pgrst, 'reload schema';

begin;

-- 1) Ensure required columns exist for item add/archive flows.
alter table if exists public.items
  add column if not exists manufacturer text;

alter table if exists public.items
  add column if not exists active boolean;

update public.items set active = true where active is null;
alter table if exists public.items alter column active set default true;

-- 2) Ensure required columns exist for location archive flows.
alter table if exists public.locations
  add column if not exists active boolean;

update public.locations set active = true where active is null;
alter table if exists public.locations alter column active set default true;

-- 3) Ensure key relationships still exist for safety checks and history.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'par_levels_item_id_fkey'
      and conrelid = 'public.par_levels'::regclass
  ) then
    alter table public.par_levels
      add constraint par_levels_item_id_fkey foreign key (item_id) references public.items(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'par_levels_location_id_fkey'
      and conrelid = 'public.par_levels'::regclass
  ) then
    alter table public.par_levels
      add constraint par_levels_location_id_fkey foreign key (location_id) references public.locations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_item_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_item_id_fkey foreign key (item_id) references public.items(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_location_id_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_location_id_fkey foreign key (location_id) references public.locations(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monthly_counts_item_id_fkey'
      and conrelid = 'public.monthly_counts'::regclass
  ) then
    alter table public.monthly_counts
      add constraint monthly_counts_item_id_fkey foreign key (item_id) references public.items(id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'monthly_counts_location_id_fkey'
      and conrelid = 'public.monthly_counts'::regclass
  ) then
    alter table public.monthly_counts
      add constraint monthly_counts_location_id_fkey foreign key (location_id) references public.locations(id);
  end if;
end
$$;

create index if not exists idx_items_manufacturer on public.items(manufacturer);
create index if not exists idx_transactions_item_location on public.transactions(item_id, location_id);
create index if not exists idx_monthly_counts_item_location on public.monthly_counts(item_id, location_id);

-- 4) Safe delete RPCs: delete only when no history is attached.
create or replace function public.delete_item_if_unused(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if exists(select 1 from public.transactions where item_id = p_item_id)
     or exists(select 1 from public.monthly_counts where item_id = p_item_id)
     or exists(select 1 from public.par_levels where item_id = p_item_id) then
    raise exception 'This item has inventory history and cannot be permanently deleted. Archive it instead.';
  end if;

  delete from public.items where id = p_item_id;
end;
$$;

create or replace function public.delete_location_if_unused(p_location_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  if exists(select 1 from public.transactions where location_id = p_location_id)
     or exists(select 1 from public.monthly_counts where location_id = p_location_id)
     or exists(select 1 from public.par_levels where location_id = p_location_id) then
    raise exception 'This location has inventory history and cannot be permanently deleted. Archive it instead.';
  end if;

  delete from public.locations where id = p_location_id;
end;
$$;

grant execute on function public.delete_item_if_unused(uuid) to authenticated;
grant execute on function public.delete_location_if_unused(uuid) to authenticated;

-- Keep admin-only delete path for par levels.
create policy if not exists "admins delete par levels" on public.par_levels for delete to authenticated using (public.is_admin());

commit;

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
