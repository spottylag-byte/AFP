-- Phase 1: minimal profiles table tied to Supabase Auth, with role-based RLS.
-- Full domain schema (players, teams, competitions, etc.) lands in Phase 2.

create type user_role as enum (
  'platform_admin',
  'organizer',
  'team_manager',
  'match_operator',
  'player',
  'scout'
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  full_name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- The client can never set/change its own role: signup role comes from
-- raw_user_meta_data via the trigger below, and this trigger blocks any
-- later client-side UPDATE from changing it. Only a service_role
-- connection (e.g. an admin-only server action in a later phase) bypasses
-- RLS and this trigger's role owner and can promote/change a role.
create function prevent_role_change()
returns trigger as $$
begin
  if new.role <> old.role then
    raise exception 'role cannot be changed directly';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger profiles_prevent_role_change
  before update on profiles
  for each row
  execute function prevent_role_change();

-- Auto-create a profile row when a new auth user signs up, reading the
-- role and full name out of the signup call's user metadata.
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'player'),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();
