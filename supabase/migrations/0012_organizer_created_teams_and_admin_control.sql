-- More real pilot feedback: grassroots teams pitched to a competition
-- are often previously unknown to the platform entirely -- no existing
-- team_manager account, no tech-savvy manager to self-register. An
-- organizer needs to be able to create a team directly and build its
-- roster themselves, with the same duplicate-detection safety net
-- team_manager already has (a player can legitimately already exist
-- from a different team/tournament -- that's the whole point of a
-- permanent Football ID -- so "same person, different team" must stay
-- a real, working path here too, not just for team_manager).

-- ---------------------------------------------------------------------
-- createTeamAsOrganizer(): organizer becomes the team's manager-of-
-- record (same teams.team_manager_profile_id column, just organizer-
-- owned instead of team_manager-owned). Optionally enters the new team
-- into the calling competition in the same step, since that's the
-- obvious reason an organizer is creating it from their competition
-- page in the first place.
-- ---------------------------------------------------------------------

create function create_team_as_organizer(p_name text, p_competition_id uuid default null)
returns uuid as $$
declare
  v_caller_role user_role;
  v_owns_competition boolean;
  v_new_team_id uuid;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();
  if v_caller_role is distinct from 'organizer' then
    raise exception 'only an organizer may create a team this way';
  end if;

  if p_competition_id is not null then
    select exists (
      select 1 from competitions c
      join organizers o on o.id = c.organizer_id
      where c.id = p_competition_id and o.profile_id = auth.uid()
    ) into v_owns_competition;

    if not v_owns_competition then
      raise exception 'competition not found or not owned by caller';
    end if;
  end if;

  insert into teams (name, team_manager_profile_id)
  values (p_name, auth.uid())
  returning id into v_new_team_id;

  if p_competition_id is not null then
    insert into competition_teams (competition_id, team_id) values (p_competition_id, v_new_team_id);
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'team_created_by_organizer',
    'teams',
    v_new_team_id,
    jsonb_build_object('name', p_name, 'competition_id', p_competition_id)
  );

  return v_new_team_id;
end;
$$ language plpgsql security definer;

revoke execute on function create_team_as_organizer(text, uuid) from public;
grant execute on function create_team_as_organizer(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Extend registerPlayer() and addExistingPlayerToTeam() so an organizer
-- who owns a team this way (not just a team_manager) can build its
-- roster -- same permission shape as the existing team_manager/
-- platform_admin branches, just a third ownership path.
-- ---------------------------------------------------------------------

drop function register_player(text, text, date, uuid, text);

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
  v_owns_team boolean;
  v_new_football_id_id uuid;
  v_new_player_id uuid;
  v_new_code text;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();

  if v_caller_role in ('team_manager', 'organizer') then
    if p_team_id is null then
      raise exception '% must specify a team when registering a player', v_caller_role;
    end if;

    select exists (
      select 1 from teams where teams.id = p_team_id and team_manager_profile_id = auth.uid()
    ) into v_owns_team;

    if not v_owns_team then
      raise exception 'team not found or not owned by caller';
    end if;
  elsif v_caller_role is distinct from 'platform_admin' then
    raise exception 'only platform_admin, organizer, or team_manager may register a player';
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

create or replace function add_existing_player_to_team(p_team_id uuid, p_player_id uuid)
returns void as $$
declare
  v_caller_role user_role;
  v_owns_team boolean;
  v_already_active boolean;
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role not in ('team_manager', 'organizer') then
    raise exception 'only a team_manager or organizer may add a player to a roster';
  end if;

  select exists (
    select 1 from teams where id = p_team_id and team_manager_profile_id = auth.uid()
  ) into v_owns_team;

  if not v_owns_team then
    raise exception 'team not found or not owned by caller';
  end if;

  select exists (
    select 1 from team_players
    where team_id = p_team_id and player_id = p_player_id and left_at is null
  ) into v_already_active;

  if v_already_active then
    raise exception 'player is already on this team''s roster';
  end if;

  insert into team_players (team_id, player_id) values (p_team_id, p_player_id);

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'player_matched_to_existing_roster',
    'team_players',
    p_player_id,
    jsonb_build_object('team_id', p_team_id, 'player_id', p_player_id)
  );
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- Admin: deactivate a user (block login via Supabase Auth's own ban
-- mechanism) rather than delete. A true hard-delete fails for any
-- account with real history anyway -- audit_logs is immutable by
-- design and foreign-keys to the actor -- so deactivation is the one
-- that actually works, and it's the one consistent with "never lose
-- verified history." No new SQL needed here; deactivation happens via
-- the Auth Admin API from a service-role server action, same pattern
-- as reading emails on the users page. This block just logs it.
-- ---------------------------------------------------------------------

create function log_admin_user_deactivation(p_profile_id uuid, p_deactivated boolean)
returns void as $$
begin
  if not is_platform_admin() then
    raise exception 'only platform_admin may deactivate a user';
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    case when p_deactivated then 'user_deactivated' else 'user_reactivated' end,
    'profiles',
    p_profile_id,
    jsonb_build_object('deactivated', p_deactivated)
  );
end;
$$ language plpgsql security definer;

revoke execute on function log_admin_user_deactivation(uuid, boolean) from public;
grant execute on function log_admin_user_deactivation(uuid, boolean) to authenticated;
