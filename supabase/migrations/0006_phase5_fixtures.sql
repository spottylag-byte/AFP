-- Phase 5: fixtures. Nothing before this phase ever populated
-- competition_teams (which teams are entered in a competition), so
-- there'd be no teams to pick between when scheduling a fixture --
-- addTeamToCompetition() is a necessary prerequisite this phase adds,
-- not a separate roadmap item.
--
-- Both functions return a scalar (uuid/void), not `returns table(...)`,
-- so neither has an implicit output variable -- the bare-id collision
-- from Phase 4 doesn't apply here, but every column reference below is
-- still explicitly table-qualified regardless, on principle.

create function add_team_to_competition(p_competition_id uuid, p_team_id uuid)
returns void as $$
declare
  caller_role user_role;
  owns_competition boolean;
  already_entered boolean;
begin
  select role into caller_role from profiles where profiles.id = auth.uid();
  if caller_role is distinct from 'organizer' then
    raise exception 'only an organizer may add a team to a competition';
  end if;

  select exists (
    select 1 from competitions c
    join organizers o on o.id = c.organizer_id
    where c.id = p_competition_id and o.profile_id = auth.uid()
  ) into owns_competition;

  if not owns_competition then
    raise exception 'competition not found or not owned by caller';
  end if;

  select exists (
    select 1 from competition_teams ct
    where ct.competition_id = p_competition_id and ct.team_id = p_team_id
  ) into already_entered;

  if already_entered then
    raise exception 'team is already entered into this competition';
  end if;

  insert into competition_teams (competition_id, team_id) values (p_competition_id, p_team_id);
end;
$$ language plpgsql security definer;

revoke execute on function add_team_to_competition(uuid, uuid) from public;
grant execute on function add_team_to_competition(uuid, uuid) to authenticated;

-- createFixture(): both teams must already be entered into the
-- competition (via the function above) before a fixture between them
-- can be scheduled. Always creates status='scheduled' -- a client can
-- never set a fixture to any other status directly.
create function create_fixture(
  p_competition_id uuid,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_scheduled_at timestamptz,
  p_venue_id uuid default null
)
returns uuid as $$
declare
  caller_role user_role;
  owns_competition boolean;
  home_entered boolean;
  away_entered boolean;
  new_match_id uuid;
begin
  select role into caller_role from profiles where profiles.id = auth.uid();
  if caller_role is distinct from 'organizer' then
    raise exception 'only an organizer may create a fixture';
  end if;

  if p_home_team_id = p_away_team_id then
    raise exception 'home and away teams must be different';
  end if;

  select exists (
    select 1 from competitions c
    join organizers o on o.id = c.organizer_id
    where c.id = p_competition_id and o.profile_id = auth.uid()
  ) into owns_competition;

  if not owns_competition then
    raise exception 'competition not found or not owned by caller';
  end if;

  select exists (
    select 1 from competition_teams ct
    where ct.competition_id = p_competition_id and ct.team_id = p_home_team_id
  ) into home_entered;

  select exists (
    select 1 from competition_teams ct
    where ct.competition_id = p_competition_id and ct.team_id = p_away_team_id
  ) into away_entered;

  if not home_entered or not away_entered then
    raise exception 'both teams must be entered into the competition before scheduling a fixture';
  end if;

  insert into matches (competition_id, home_team_id, away_team_id, venue_id, scheduled_at, status)
  values (p_competition_id, p_home_team_id, p_away_team_id, p_venue_id, p_scheduled_at, 'scheduled')
  returning matches.id into new_match_id;

  return new_match_id;
end;
$$ language plpgsql security definer;

revoke execute on function create_fixture(uuid, uuid, uuid, timestamptz, uuid) from public;
grant execute on function create_fixture(uuid, uuid, uuid, timestamptz, uuid) to authenticated;
