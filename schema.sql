-- KT Design Lab — approval-based access schema.
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- New registrations are pending until an administrator approves them.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'engineer' check (role in ('admin','engineer','viewer')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists status text not null default 'pending';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('pending','approved','rejected'));
create table if not exists public.design_projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_name text not null, tool_key text not null, project_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists design_projects_owner_updated_idx on public.design_projects(owner_id, updated_at desc);
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id,email,role,status) values (new.id,new.email,'engineer','pending')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_kt_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin' and p.status='approved');
$$;
alter table public.profiles enable row level security;
alter table public.design_projects enable row level security;
drop policy if exists "profile_select_self_or_admin" on public.profiles;
create policy "profile_select_self_or_admin" on public.profiles for select to authenticated
using (id=(select auth.uid()) or public.is_kt_admin());
drop policy if exists "projects_select_owner" on public.design_projects;
create policy "projects_select_owner" on public.design_projects for select to authenticated
using (owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved'));
drop policy if exists "projects_insert_owner" on public.design_projects;
create policy "projects_insert_owner" on public.design_projects for insert to authenticated
with check (owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved'));
drop policy if exists "projects_update_owner" on public.design_projects;
create policy "projects_update_owner" on public.design_projects for update to authenticated
using (owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved'))
with check (owner_id=(select auth.uid()));
drop policy if exists "projects_delete_owner" on public.design_projects;
create policy "projects_delete_owner" on public.design_projects for delete to authenticated
using (owner_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='approved'));
grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.design_projects to authenticated;
create or replace function public.review_kt_user(target_user_id uuid,decision text,assigned_role text default 'engineer')
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_kt_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if assigned_role not in ('admin','engineer','viewer') then raise exception 'Invalid role'; end if;
  update public.profiles set status=decision,role=case when decision='approved' then assigned_role else role end
  where id=target_user_id and status='pending';
  if not found then raise exception 'Pending user not found'; end if;
end;
$$;
revoke all on function public.review_kt_user(uuid,text,text) from public;
grant execute on function public.review_kt_user(uuid,text,text) to authenticated;
-- BOOTSTRAP: after creating your own account and confirming its email, replace the email below and run:
-- update public.profiles set role='admin',status='approved' where lower(email)=lower('YOUR-ADMIN-EMAIL');
-- Repeat that update for every trusted administrator. Do not expose service_role keys in browser files.
