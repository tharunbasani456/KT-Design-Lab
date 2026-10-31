-- KT Design Lab — initial Supabase schema (Release 0.1)
-- Run in Supabase SQL Editor only after reviewing the project settings.
-- Access is private: invite users from Supabase Dashboard > Authentication > Users.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'engineer' check (role in ('admin','engineer','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.design_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null,
  tool_key text not null,
  project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_projects_owner_updated_idx
  on public.design_projects(owner_id, updated_at desc);

-- Create a profile for every newly invited/created Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'engineer')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Admin check is evaluated against the protected profiles table.
create or replace function public.is_kt_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.design_projects enable row level security;

-- Users can read only their own profile; admins can read all profiles.
drop policy if exists "profile_select_self_or_admin" on public.profiles;
create policy "profile_select_self_or_admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_kt_admin());

-- No client-side INSERT/UPDATE/DELETE policy on profiles. Assign roles only
-- from the Supabase SQL editor / trusted administrative backend.

-- Each member can access only their own saved projects.
drop policy if exists "projects_select_owner" on public.design_projects;
create policy "projects_select_owner" on public.design_projects
for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "projects_insert_owner" on public.design_projects;
create policy "projects_insert_owner" on public.design_projects
for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists "projects_update_owner" on public.design_projects;
create policy "projects_update_owner" on public.design_projects
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "projects_delete_owner" on public.design_projects;
create policy "projects_delete_owner" on public.design_projects
for delete to authenticated using (owner_id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.design_projects to authenticated;

-- After your own account has accepted an invitation and signed in once,
-- promote it to administrator by replacing the email below and running:
-- update public.profiles set role = 'admin' where lower(email) = lower('YOUR-ADMIN-EMAIL');
