-- Fix admin profiles, backfill roles, and enforce RLS.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','staff'));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.active = true);
$$;

create or replace function public.is_active_user()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.active = true);
$$;

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles (id,email,role,active)
  values (new.id,new.email,case when lower(new.email) in ('cfuentes@nohn-pa.org','crsfnts@gmail.com') then 'admin' else 'staff' end,true)
  on conflict (id) do update set email=excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_user_profile();

insert into public.profiles (id,email,role,active)
select u.id,u.email,case when lower(u.email) in ('cfuentes@nohn-pa.org','crsfnts@gmail.com') then 'admin' else 'staff' end,true
from auth.users u
on conflict (id) do update set email=excluded.email;

update public.profiles p set role='admin', active=true
from auth.users u
where p.id=u.id and lower(u.email) in ('cfuentes@nohn-pa.org','crsfnts@gmail.com');

alter table public.items enable row level security;
alter table public.locations enable row level security;
alter table public.par_levels enable row level security;
alter table public.transactions enable row level security;
alter table public.monthly_counts enable row level security;
alter table public.profiles enable row level security;

-- profiles
 drop policy if exists "Users read own profile" on public.profiles;
 drop policy if exists "Admins read all profiles" on public.profiles;
 drop policy if exists "Admins update profiles" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Admins read all profiles" on public.profiles for select to authenticated using (public.is_admin());
create policy "Admins update profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- items
 drop policy if exists "Authenticated users can read active items" on public.items;
 drop policy if exists "Admins manage items" on public.items;
create policy "Authenticated users can read active items" on public.items for select to authenticated using (public.is_active_user() and active = true or public.is_admin());
create policy "Admins manage items" on public.items for insert to authenticated with check (public.is_admin());
create policy "Admins update items" on public.items for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- locations
 drop policy if exists "Authenticated users can read active locations" on public.locations;
 drop policy if exists "Admins manage locations" on public.locations;
create policy "Authenticated users can read active locations" on public.locations for select to authenticated using (public.is_active_user() and active = true or public.is_admin());
create policy "Admins insert locations" on public.locations for insert to authenticated with check (public.is_admin());
create policy "Admins update locations" on public.locations for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- par_levels
 drop policy if exists "Authenticated users can read par levels" on public.par_levels;
 drop policy if exists "Admins manage par levels" on public.par_levels;
create policy "Authenticated users can read par levels" on public.par_levels for select to authenticated using (public.is_active_user());
create policy "Admins manage par levels" on public.par_levels for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- transactions append-only
 drop policy if exists "Authenticated users can read transactions" on public.transactions;
 drop policy if exists "Authenticated users can insert transactions" on public.transactions;
create policy "Authenticated users can read transactions" on public.transactions for select to authenticated using (public.is_active_user());
create policy "Authenticated users can insert transactions" on public.transactions for insert to authenticated with check (
  public.is_active_user() and auth.uid() = user_id and (
    action in ('ADD','REMOVE','TRANSFER_IN','TRANSFER_OUT','MONTHLY_ADJUSTMENT') or
    (action in ('OPENING_BALANCE','ADMIN_ADJUSTMENT') and public.is_admin())
  )
);

-- monthly_counts
 drop policy if exists "Authenticated users can read monthly counts" on public.monthly_counts;
 drop policy if exists "Authenticated users can insert monthly_counts" on public.monthly_counts;
create policy "Authenticated users can read monthly counts" on public.monthly_counts for select to authenticated using (public.is_active_user());
create policy "Authenticated users can insert monthly counts" on public.monthly_counts for insert to authenticated with check (public.is_active_user() and auth.uid() = user_id);
