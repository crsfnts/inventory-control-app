-- RBAC migration for Inventory Control
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, case when lower(new.email) = 'cfuentes@nohn-pa.org' then 'admin' else 'staff' end)
  on conflict (id) do update
    set email = excluded.email,
        role = case when excluded.email = 'cfuentes@nohn-pa.org' then 'admin' else public.profiles.role end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, email, role)
select id, email, case when lower(email) = 'cfuentes@nohn-pa.org' then 'admin' else 'staff' end
from auth.users
on conflict (id) do update
set email = excluded.email,
    role = case when lower(excluded.email) = 'cfuentes@nohn-pa.org' then 'admin' else public.profiles.role end;

-- Ensure legacy transaction action constraint supports new action names
alter table public.transactions drop constraint if exists transactions_action_check;
alter table public.transactions add constraint transactions_action_check
check (action in ('OPENING_BALANCE','ADD','REMOVE','TRANSFER_IN','TRANSFER_OUT','ADMIN_ADJUSTMENT','MONTHLY_ADJUSTMENT'));

-- RLS policies
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select to authenticated using (public.is_admin());

drop policy if exists "Admins can manage items" on public.items;
drop policy if exists "Authenticated users can manage items" on public.items;
create policy "Admins can manage items" on public.items for all to authenticated using (public.is_admin()) with check (public.is_admin());

 drop policy if exists "Authenticated users can read items" on public.items;
create policy "Authenticated users can read active items" on public.items for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Admins can manage locations" on public.locations;
drop policy if exists "Authenticated users can manage locations" on public.locations;
create policy "Admins can manage locations" on public.locations for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read locations" on public.locations;
create policy "Authenticated users can read active locations" on public.locations for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Admins can manage par levels" on public.par_levels;
drop policy if exists "Authenticated users can manage par levels" on public.par_levels;
create policy "Admins can manage par levels" on public.par_levels for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read par levels" on public.par_levels;
create policy "Authenticated users can read par levels" on public.par_levels for select to authenticated using (true);

drop policy if exists "Authenticated users can read transactions" on public.transactions;
create policy "Authenticated users can read transactions" on public.transactions for select to authenticated using (true);
drop policy if exists "Authenticated users can insert transactions" on public.transactions;
create policy "Authenticated users can insert transactions" on public.transactions for insert to authenticated with check (auth.uid() = user_id);

-- no update/delete transaction policy: append-only

drop policy if exists "Authenticated users can read monthly counts" on public.monthly_counts;
create policy "Authenticated users can read monthly counts" on public.monthly_counts for select to authenticated using (true);
drop policy if exists "Authenticated users can insert monthly counts" on public.monthly_counts;
create policy "Authenticated users can insert monthly_counts" on public.monthly_counts for insert to authenticated with check (auth.uid() = user_id);
