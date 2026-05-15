alter table if exists public.items add column if not exists manufacturer text;
create index if not exists idx_items_manufacturer on public.items(manufacturer);
create index if not exists idx_transactions_item_location on public.transactions(item_id, location_id);
create index if not exists idx_monthly_counts_item_location on public.monthly_counts(item_id, location_id);

create or replace function public.delete_item_if_unused(item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if exists(select 1 from public.transactions where transactions.item_id=delete_item_if_unused.item_id)
  or exists(select 1 from public.monthly_counts where monthly_counts.item_id=delete_item_if_unused.item_id)
  or exists(select 1 from public.par_levels where par_levels.item_id=delete_item_if_unused.item_id)
  then raise exception 'This item has inventory history and cannot be permanently deleted. Archive it instead to preserve the audit trail.'; end if;
  delete from public.items where id=delete_item_if_unused.item_id;
end; $$;

create or replace function public.delete_location_if_unused(location_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required.'; end if;
  if exists(select 1 from public.transactions where transactions.location_id=delete_location_if_unused.location_id)
  or exists(select 1 from public.monthly_counts where monthly_counts.location_id=delete_location_if_unused.location_id)
  or exists(select 1 from public.par_levels where par_levels.location_id=delete_location_if_unused.location_id)
  then raise exception 'This location has inventory history and cannot be permanently deleted. Archive it instead to preserve the audit trail.'; end if;
  delete from public.locations where id=delete_location_if_unused.location_id;
end; $$;

grant execute on function public.delete_item_if_unused(uuid) to authenticated;
grant execute on function public.delete_location_if_unused(uuid) to authenticated;

create policy if not exists "admins delete par levels" on public.par_levels for delete to authenticated using (public.is_admin());
