-- Phase 4: team onboarding and squad building. Extends (not duplicates)
-- Phase 2's register_player()/search_existing_player() with roster
-- context, per Section 10's single-canonical-function contract, and
-- adds the "team overlap" duplicate signal Phase 2 deferred because no
-- roster data existed yet.

-- ---------------------------------------------------------------------
-- Team manager self-service: create own team (same pattern as Phase 3's
-- organizer onboarding).
-- ---------------------------------------------------------------------

create policy "Team manager can create own team"
  on teams for insert
  to authenticated
  with check (
    team_manager_profile_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'team_manager')
  );

-- ---------------------------------------------------------------------
-- search_existing_player(): add an optional team_id so a candidate
-- already on THAT roster can be flagged distinctly from a generic
-- system-wide duplicate -- the "team/competition overlap" signal from
-- Section 5. Signature changes (2 args -> 3 args), so the old overload
-- must be dropped first or both would coexist ambiguously.
-- ---------------------------------------------------------------------

drop function search_existing_player(text, date);

create function search_existing_player(
  p_full_name text,
  p_date_of_birth date,
  p_team_id uuid default null
)
returns table (
  id uuid,
  full_name text,
  date_of_birth date,
  football_id_code text,
  similarity real,
  already_on_this_team boolean
) as $$
  select
    p.id,
    p.full_name,
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

-- ---------------------------------------------------------------------
-- register_player(): add an optional team_id. platform_admin keeps
-- Phase 2 behaviour (team_id stays null, nothing else changes for that
-- caller). team_manager must supply a team they own; the new player is
-- attached to that team's roster in the same call.
-- ---------------------------------------------------------------------

drop function register_player(text, date);

create function register_player(
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

revoke execute on function register_player(text, date, uuid) from public;
grant execute on function register_player(text, date, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- addExistingPlayerToTeam(): the "this is the same person" branch of
-- duplicate review -- attach an existing player to this roster instead
-- of creating a new record. Never auto-merges anything; it's still a
-- human choosing this over "register as new" after seeing candidates.
-- ---------------------------------------------------------------------

create function add_existing_player_to_team(p_team_id uuid, p_player_id uuid)
returns void as $$
declare
  caller_role user_role;
  owns_team boolean;
  already_active boolean;
begin
  select role into caller_role from profiles where id = auth.uid();
  if caller_role is distinct from 'team_manager' then
    raise exception 'only a team_manager may add a player to a roster';
  end if;

  select exists (
    select 1 from teams where id = p_team_id and team_manager_profile_id = auth.uid()
  ) into owns_team;

  if not owns_team then
    raise exception 'team not found or not owned by caller';
  end if;

  select exists (
    select 1 from team_players
    where team_id = p_team_id and player_id = p_player_id and left_at is null
  ) into already_active;

  if already_active then
    raise exception 'player is already on this team''s roster';
  end if;

  insert into team_players (team_id, player_id) values (p_team_id, p_player_id);
end;
$$ language plpgsql security definer;

revoke execute on function add_existing_player_to_team(uuid, uuid) from public;
grant execute on function add_existing_player_to_team(uuid, uuid) to authenticated;
