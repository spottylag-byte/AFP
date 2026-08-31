-- Phase 2: full domain schema (Section 5), Football ID system, and
-- registerPlayer()/searchExistingPlayer() duplicate detection.
--
-- Most of these tables have no UI yet (that's Phases 3-7) -- this
-- migration is infrastructure, matching the vertical-slice rule's
-- carve-out for pure infra setup. The one working slice this phase is
-- player registration + duplicate detection (admin-only for now).

-- ---------------------------------------------------------------------
-- Fix: the Phase 1 trigger blocking role changes on `profiles` had no
-- escape hatch -- not even for a superuser running SQL directly, so
-- there was no way to ever promote an account to platform_admin. This
-- allows the change only when run as the Postgres superuser (the
-- Supabase SQL Editor) or the service_role connection (a future
-- admin-only server action) -- ordinary logged-in users still can't
-- change their own role.
-- ---------------------------------------------------------------------

-- Deliberately NOT security definer: that would make current_user
-- resolve to this function's owner for the whole check, defeating the
-- purpose (it would always see 'postgres' and never block anything).
-- Running as invoker means current_user is the role actually performing
-- the UPDATE -- 'postgres' for the SQL Editor, 'service_role' for a
-- future admin server action, 'authenticated' for an ordinary user.
create or replace function prevent_role_change()
returns trigger as $$
begin
  if new.role <> old.role and current_user not in ('postgres', 'service_role') then
    raise exception 'role cannot be changed directly';
  end if;
  return new;
end;
$$ language plpgsql security invoker;

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- Identity: football_ids, players
-- ---------------------------------------------------------------------

create sequence football_id_seq start 1;

create table football_ids (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table football_ids enable row level security;

create policy "Anyone authenticated can view football_ids"
  on football_ids for select
  to authenticated
  using (true);

-- System-only: never called directly by client code, only from
-- registerPlayer() below. Not granted to `authenticated`.
create function create_football_id()
returns uuid as $$
declare
  new_code text;
  new_id uuid;
begin
  new_code := 'AF-' || lpad(nextval('football_id_seq')::text, 7, '0');
  insert into football_ids (code) values (new_code) returning id into new_id;
  return new_id;
end;
$$ language plpgsql security definer;

create table players (
  id uuid primary key default gen_random_uuid(),
  football_id_id uuid not null unique references football_ids (id),
  profile_id uuid references profiles (id),
  full_name text not null,
  date_of_birth date not null,
  created_by uuid not null references profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index players_full_name_trgm_idx on players using gin (full_name gin_trgm_ops);
create index players_date_of_birth_idx on players (date_of_birth);

alter table players enable row level security;

create policy "Anyone authenticated can view players"
  on players for select
  to authenticated
  using (deleted_at is null);

-- ---------------------------------------------------------------------
-- Organizations: organizers, teams, venues, match_officials
-- ---------------------------------------------------------------------

create table organizers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  organization_name text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table organizers enable row level security;

create policy "Anyone authenticated can view organizers"
  on organizers for select
  to authenticated
  using (deleted_at is null);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_manager_profile_id uuid not null references profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;

create policy "Anyone authenticated can view teams"
  on teams for select
  to authenticated
  using (deleted_at is null);

create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table venues enable row level security;

create policy "Anyone authenticated can view venues"
  on venues for select
  to authenticated
  using (deleted_at is null);

create table match_officials (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  profile_id uuid references profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table match_officials enable row level security;

create policy "Anyone authenticated can view match officials"
  on match_officials for select
  to authenticated
  using (deleted_at is null);

-- ---------------------------------------------------------------------
-- Competition: competitions, competition_teams, competition_statistics
-- ---------------------------------------------------------------------

create table competitions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references organizers (id),
  name text not null,
  season text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'completed', 'cancelled')),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table competitions enable row level security;

create policy "Anyone authenticated can view published competitions"
  on competitions for select
  to authenticated
  using (deleted_at is null and status <> 'draft');

create policy "Organizer can view own draft competitions"
  on competitions for select
  to authenticated
  using (
    deleted_at is null
    and organizer_id in (
      select id from organizers where profile_id = auth.uid()
    )
  );

create table competition_teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  team_id uuid not null references teams (id),
  created_at timestamptz not null default now(),
  unique (competition_id, team_id)
);

alter table competition_teams enable row level security;

create policy "Anyone authenticated can view competition_teams"
  on competition_teams for select
  to authenticated
  using (true);

create table competition_statistics (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null unique references competitions (id),
  matches_played int not null default 0,
  total_goals int not null default 0,
  updated_at timestamptz not null default now()
);

alter table competition_statistics enable row level security;

create policy "Anyone authenticated can view competition_statistics"
  on competition_statistics for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Roster: team_players, match_lineups
-- ---------------------------------------------------------------------

create table team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id),
  player_id uuid not null references players (id),
  joined_at date not null default current_date,
  left_at date,
  created_at timestamptz not null default now()
);

alter table team_players enable row level security;

create policy "Anyone authenticated can view team_players"
  on team_players for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Match: matches, match_events (append-only)
-- ---------------------------------------------------------------------

create table matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  home_team_id uuid not null references teams (id),
  away_team_id uuid not null references teams (id),
  venue_id uuid references venues (id),
  scheduled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'finished', 'verified', 'published', 'cancelled')),
  auto_verify_at timestamptz,
  home_score int,
  away_score int,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table matches enable row level security;

create policy "Anyone authenticated can view matches"
  on matches for select
  to authenticated
  using (deleted_at is null);

create table match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id),
  player_id uuid not null references players (id),
  team_id uuid not null references teams (id),
  position text,
  is_starting boolean not null default true,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

alter table match_lineups enable row level security;

create policy "Anyone authenticated can view match_lineups"
  on match_lineups for select
  to authenticated
  using (true);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id),
  player_id uuid references players (id),
  team_id uuid references teams (id),
  event_type text not null
    check (event_type in ('goal', 'own_goal', 'yellow_card', 'red_card', 'substitution_in', 'substitution_out', 'correction')),
  minute int,
  source text not null default 'match_center'
    check (source in ('match_center', 'whatsapp_bot')),
  recorded_by uuid references profiles (id),
  compensates_event_id uuid references match_events (id),
  created_at timestamptz not null default now()
);

alter table match_events enable row level security;

create policy "Anyone authenticated can view match_events"
  on match_events for select
  to authenticated
  using (true);

-- Append-only: no client role may ever UPDATE or DELETE a match event.
-- Corrections add a new compensating row (compensates_event_id) instead.
create function block_match_event_mutation()
returns trigger as $$
begin
  raise exception 'match_events is append-only: % not permitted', tg_op;
end;
$$ language plpgsql security invoker;

create trigger match_events_block_update
  before update on match_events
  for each row
  execute function block_match_event_mutation();

create trigger match_events_block_delete
  before delete on match_events
  for each row
  execute function block_match_event_mutation();

-- ---------------------------------------------------------------------
-- Statistics: 100% derived, never written directly by user-facing code
-- ---------------------------------------------------------------------

create table player_match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id),
  player_id uuid not null references players (id),
  goals int not null default 0,
  own_goals int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

alter table player_match_stats enable row level security;

create policy "Anyone authenticated can view player_match_stats"
  on player_match_stats for select
  to authenticated
  using (true);

create table player_competition_stats (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  player_id uuid not null references players (id),
  goals int not null default 0,
  appearances int not null default 0,
  yellow_cards int not null default 0,
  red_cards int not null default 0,
  updated_at timestamptz not null default now(),
  unique (competition_id, player_id)
);

alter table player_competition_stats enable row level security;

create policy "Anyone authenticated can view player_competition_stats"
  on player_competition_stats for select
  to authenticated
  using (true);

create table team_statistics (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  team_id uuid not null references teams (id),
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  points int not null default 0,
  updated_at timestamptz not null default now(),
  unique (competition_id, team_id)
);

alter table team_statistics enable row level security;

create policy "Anyone authenticated can view team_statistics"
  on team_statistics for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Trust & audit
-- ---------------------------------------------------------------------

create table verification_records (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id),
  verified_by uuid references profiles (id),
  verification_type text not null check (verification_type in ('manual', 'auto_promoted')),
  verified_at timestamptz not null default now()
);

alter table verification_records enable row level security;

create policy "Anyone authenticated can view verification_records"
  on verification_records for select
  to authenticated
  using (true);

create table correction_requests (
  id uuid primary key default gen_random_uuid(),
  match_event_id uuid not null references match_events (id),
  requested_by uuid not null references profiles (id),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'escalated')),
  evidence_url text,
  reviewed_by uuid references profiles (id),
  review_notes text,
  resulting_event_id uuid references match_events (id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table correction_requests enable row level security;

create policy "Requester or admin can view correction_requests"
  on correction_requests for select
  to authenticated
  using (
    requested_by = auth.uid()
    or exists (
      select 1 from profiles where id = auth.uid() and role = 'platform_admin'
    )
  );

-- Append-only, immutable: audit_logs rows are never updated or deleted.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

create policy "Admin can view audit_logs"
  on audit_logs for select
  to authenticated
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'platform_admin'
    )
  );

create function block_audit_log_mutation()
returns trigger as $$
begin
  raise exception 'audit_logs is append-only and immutable: % not permitted', tg_op;
end;
$$ language plpgsql security invoker;

create trigger audit_logs_block_update
  before update on audit_logs
  for each row
  execute function block_audit_log_mutation();

create trigger audit_logs_block_delete
  before delete on audit_logs
  for each row
  execute function block_audit_log_mutation();

-- ---------------------------------------------------------------------
-- Commercial
-- ---------------------------------------------------------------------

create table competition_payments (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions (id),
  amount numeric(12, 2) not null,
  currency text not null default 'NGN',
  provider text not null check (provider in ('paystack', 'flutterwave')),
  provider_reference text unique,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'waived')),
  waived_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

alter table competition_payments enable row level security;

create policy "Organizer or admin can view own competition_payments"
  on competition_payments for select
  to authenticated
  using (
    competition_id in (
      select c.id from competitions c
      join organizers o on o.id = c.organizer_id
      where o.profile_id = auth.uid()
    )
    or exists (
      select 1 from profiles where id = auth.uid() and role = 'platform_admin'
    )
  );

-- ---------------------------------------------------------------------
-- Duplicate detection: searchExistingPlayer() + registerPlayer()
-- ---------------------------------------------------------------------

-- Read-only, relies on the players SELECT policy above (no elevated
-- privileges needed). A candidate is surfaced when the name is a close
-- fuzzy match, or the name is a looser match AND the date of birth is
-- identical -- either signal alone at a lower bar is too noisy.
create function search_existing_player(p_full_name text, p_date_of_birth date)
returns table (
  id uuid,
  full_name text,
  date_of_birth date,
  football_id_code text,
  similarity real
) as $$
  select
    p.id,
    p.full_name,
    p.date_of_birth,
    fi.code,
    similarity(p.full_name, p_full_name) as similarity
  from players p
  join football_ids fi on fi.id = p.football_id_id
  where p.deleted_at is null
    and (
      similarity(p.full_name, p_full_name) > 0.6
      or (p.date_of_birth = p_date_of_birth and similarity(p.full_name, p_full_name) > 0.3)
    )
  order by similarity desc
  limit 5;
$$ language sql stable;

-- The only path that may create a player + Football ID. Restricted to
-- platform_admin for now -- Team Manager gets a roster-scoped path to
-- this same function in Phase 4, once teams have registration UI.
-- SECURITY DEFINER because ordinary authenticated users must not have a
-- direct INSERT policy on players/football_ids: this function is the
-- only funnel, so every player creation is auditable and permission-
-- checked in one place, per the "never trust the client" golden rule.
create function register_player(p_full_name text, p_date_of_birth date)
returns table (id uuid, football_id_code text) as $$
declare
  caller_role user_role;
  new_football_id_id uuid;
  new_player_id uuid;
  new_code text;
begin
  select role into caller_role from profiles where profiles.id = auth.uid();

  if caller_role is distinct from 'platform_admin' then
    raise exception 'only platform_admin may register a player directly in Phase 2';
  end if;

  new_football_id_id := create_football_id();

  insert into players (football_id_id, full_name, date_of_birth, created_by)
  values (new_football_id_id, p_full_name, p_date_of_birth, auth.uid())
  returning players.id into new_player_id;

  select code into new_code from football_ids where football_ids.id = new_football_id_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'player_registered',
    'players',
    new_player_id,
    jsonb_build_object('full_name', p_full_name, 'date_of_birth', p_date_of_birth, 'football_id', new_code)
  );

  return query select new_player_id, new_code;
end;
$$ language plpgsql security definer;

-- Postgres grants EXECUTE to PUBLIC by default; lock create_football_id()
-- down so it's only reachable through register_player()'s permission
-- check and audit log, never called directly by a client.
revoke execute on function create_football_id() from public;
grant execute on function search_existing_player(text, date) to authenticated;
grant execute on function register_player(text, date) to authenticated;
