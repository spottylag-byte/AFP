-- Fix a bug in Phase 4's register_player(): it returns a table with a
-- column named `id`, which plpgsql implicitly makes a variable in the
-- function body -- so the team-ownership check's bare `select 1 from
-- teams where id = p_team_id ...` was ambiguous between teams.id and
-- that output variable, and every team_manager registration of a NEW
-- player failed with "column reference \"id\" is ambiguous" (the
-- add-existing-player-to-roster path was unaffected, it has no `id`
-- output column). Same signature as the version just applied, so this
-- is a straight CREATE OR REPLACE, no DROP needed.

create or replace function register_player(
  p_full_name text,
  p_date_of_birth date,
  p_team_id uuid default null
)
returns table (id uuid, football_id_code text) as $$
declare
  caller_role user_role;
  new_football_id_id uuid;
  new_player_id uuid;
  new_code text;
begin
  select role into caller_role from profiles where profiles.id = auth.uid();

  if caller_role = 'team_manager' then
    if p_team_id is null then
      raise exception 'team_manager must specify a team when registering a player';
    end if;
    if not exists (
      select 1 from teams where teams.id = p_team_id and team_manager_profile_id = auth.uid()
    ) then
      raise exception 'team not found or not owned by caller';
    end if;
  elsif caller_role is distinct from 'platform_admin' then
    raise exception 'only platform_admin or team_manager may register a player';
  end if;

  new_football_id_id := create_football_id();

  insert into players (football_id_id, full_name, date_of_birth, created_by)
  values (new_football_id_id, p_full_name, p_date_of_birth, auth.uid())
  returning players.id into new_player_id;

  select code into new_code from football_ids where football_ids.id = new_football_id_id;

  if p_team_id is not null then
    insert into team_players (team_id, player_id) values (p_team_id, new_player_id);
  end if;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'player_registered',
    'players',
    new_player_id,
    jsonb_build_object(
      'full_name', p_full_name,
      'date_of_birth', p_date_of_birth,
      'football_id', new_code,
      'team_id', p_team_id
    )
  );

  return query select new_player_id, new_code;
end;
$$ language plpgsql security definer;
