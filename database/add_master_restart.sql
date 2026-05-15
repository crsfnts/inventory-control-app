-- Admin-only Master Restart for Inventory Control
-- Clears inventory data but preserves auth users, profiles, and roles.

create or replace function public.master_restart_inventory()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.';
  end if;

  truncate table
    public.transactions,
    public.monthly_counts,
    public.par_levels,
    public.items,
    public.locations
  restart identity;

  notify pgrst, 'reload schema';
end;
$$;

revoke all on function public.master_restart_inventory() from public;
grant execute on function public.master_restart_inventory() to authenticated;
