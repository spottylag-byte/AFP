-- Real feedback from the Phase 10 pilot: (1) split "full name" into
-- first/last name everywhere, plus an alias field on players only,
-- (2) admin needs actual visibility into the platform, (3) admin needs
-- a legitimate, audited way to change a user's role -- today the ONLY
-- path that has ever worked is hand-run SQL as the founder, which
-- isn't sustainable for real operation.

-- ---------------------------------------------------------------------
-- Fix: no RLS policy has ever let admin see any profile but their own
-- (plus match_operator ones specifically, from Phase 6). That's the
-- actual blocker behind "admin can't see what's going on" -- everything
-- else in this migration needs it, so it goes first.
--
-- Wrapped in a SECURITY DEFINER helper rather than inlining the
-- self-referencing subquery directly in the policy: the inline version
-- works (Postgres resolves it via the "own profile" policy, it's not
-- true infinite recursion), but wrapping it is the documented safer
-- idiom and avoids re-evaluating RLS on the subquery at all.
-- ---------------------------------------------------------------------

create function is_platform_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'platform_admin'
  );
$$ language sql security definer stable;

create policy "Admin can view all profiles"
  on profiles for select
  to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------
-- adminChangeUserRole(): the first legitimate, audited path to ever
-- change someone's role. Works specifically because it's SECURITY
-- DEFINER (owned by postgres): the UPDATE it issues runs with
-- current_user = 'postgres', which is exactly the escape hatch
-- prevent_role_change() (Phase 1, fixed Phase 2) was written to allow.
-- ---------------------------------------------------------------------

create function admin_change_user_role(p_profile_id uuid, p_new_role user_role)
returns void as $$
declare
  v_old_role user_role;
begin
  if not is_platform_admin() then
    raise exception 'only platform_admin may change a user role';
  end if;

  select role into v_old_role from profiles where profiles.id = p_profile_id;
  if v_old_role is null then
    raise exception 'profile not found';
  end if;

  update profiles set role = p_new_role where profiles.id = p_profile_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'user_role_changed',
    'profiles',
    p_profile_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role)
  );
end;
$$ language plpgsql security definer;

revoke execute on function admin_change_user_role(uuid, user_role) from public;
grant execute on function admin_change_user_role(uuid, user_role) to authenticated;

-- ---------------------------------------------------------------------
-- Name fields: first_name/last_name on profiles and players, alias on
-- players only. full_name becomes a generated column (first || ' ' ||
-- last) instead of a plain one -- every existing SELECT that reads
-- full_name keeps working unmodified; only the places that WRITE it
-- (handle_new_user, register_player) need updating, since Postgres
-- rejects an explicit INSERT into a generated column.
-- ---------------------------------------------------------------------

alter table profiles add column first_name text;
alter table profiles add column last_name text;

update profiles
set
  first_name = split_part(full_name, ' ', 1),
  last_name = case
    when position(' ' in full_name) > 0
    then trim(substring(full_name from position(' ' in full_name) + 1))
    else ''
  end
where first_name is null;

alter table profiles alter column first_name set not null;
alter table profiles alter column last_name set not null;

alter table profiles drop column full_name;
alter table profiles add column full_name text generated always as (first_name || ' ' || last_name) stored;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, first_name, last_name, whatsapp_number)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'player'),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'whatsapp_number'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

alter table players add column first_name text;
alter table players add column last_name text;
alter table players add column alias text;

update players
set
  first_name = split_part(full_name, ' ', 1),
  last_name = case
    when position(' ' in full_name) > 0
    then trim(substring(full_name from position(' ' in full_name) + 1))
    else ''
  end
where first_name is null;

alter table players alter column first_name set not null;
alter table players alter column last_name set not null;

drop index players_full_name_trgm_idx;
alter table players drop column full_name;
alter table players add column full_name text generated always as (first_name || ' ' || last_name) stored;
create index players_full_name_trgm_idx on players using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- registerPlayer(): first_name/last_name/alias instead of one combined
-- full_name. Input signature changed (not just an added trailing
-- default), so this needs a real drop-and-recreate.
-- ---------------------------------------------------------------------

drop function register_player(text, date, uuid);

create function register_player(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_team_id uuid default null,
  p_alias text default null
)
returns table (id uuid, football_id_code text) as $$
declare
  v_caller_role user_role;
  v_new_football_id_id uuid;
  v_new_player_id uuid;
  v_new_code text;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();

  if v_caller_role = 'team_manager' then
    if p_team_id is null then
      raise exception 'team_manager must specify a team when registering a player';
    end if;
    if not exists (
      select 1 from teams where teams.id = p_team_id and team_manager_profile_id = auth.uid()
    ) then
      raise exception 'team not found or not owned by caller';
    end if;
  elsif v_caller_role is distinct from 'platform_admin' then
    raise exception 'only platform_admin or team_manager may register a player';
  end if;

  v_new_football_id_id := create_football_id();

  insert into players (football_id_id, first_name, last_name, alias, date_of_birth, created_by)
  values (v_new_football_id_id, p_first_name, p_last_name, p_alias, p_date_of_birth, auth.uid())
  returning players.id into v_new_player_id;

  select code into v_new_code from football_ids where football_ids.id = v_new_football_id_id;

  if p_team_id is not null then
    insert into team_players (team_id, player_id) values (p_team_id, v_new_player_id);
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'player_registered',
    'players',
    v_new_player_id,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'alias', p_alias,
      'date_of_birth', p_date_of_birth,
      'football_id', v_new_code,
      'team_id', p_team_id
    )
  );

  return query select v_new_player_id, v_new_code;
end;
$$ language plpgsql security definer;

revoke execute on function register_player(text, text, date, uuid, text) from public;
grant execute on function register_player(text, text, date, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- searchExistingPlayer(): same inputs (the client still concatenates
-- first+last into one string for fuzzy matching -- alias is display-
-- only, deliberately not a matching signal), but now also returns
-- alias so a reviewer sees "John Okafor (Jay-Jay)" on a candidate, not
-- just the real name. Output shape changed, so this needs a real
-- drop-and-recreate even though the inputs didn't change.
-- ---------------------------------------------------------------------

drop function search_existing_player(text, date, uuid);

create function search_existing_player(
  p_full_name text,
  p_date_of_birth date,
  p_team_id uuid default null
)
returns table (
  id uuid,
  full_name text,
  alias text,
  date_of_birth date,
  football_id_code text,
  similarity real,
  already_on_this_team boolean
) as $$
  select
    p.id,
    p.full_name,
    p.alias,
    p.date_of_birth,
    fi.code,
    similarity(p.full_name, p_full_name) as similarity,
    (
      p_team_id is not null
      and exists (
        select 1 from team_players tp
        where tp.team_id = p_team_id and tp.player_id = p.id and tp.left_at is null
      )
    ) as already_on_this_team
  from players p
  join football_ids fi on fi.id = p.football_id_id
  where p.deleted_at is null
    and (
      similarity(p.full_name, p_full_name) > 0.6
      or (p.date_of_birth = p_date_of_birth and similarity(p.full_name, p_full_name) > 0.3)
    )
  order by already_on_this_team desc, similarity desc
  limit 5;
$$ language sql stable;

revoke execute on function search_existing_player(text, date, uuid) from public;
grant execute on function search_existing_player(text, date, uuid) to authenticated;
