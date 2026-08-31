-- Phase 7: statistics engine. Everything here recomputes from scratch
-- (delete + re-insert) rather than incrementing counters, so a rerun is
-- always correct -- this matters once Phase 8 corrections start adding
-- compensating events that must trigger recalculation.
--
-- Local variables are all v_-prefixed throughout, specifically to avoid
-- the Phase 4 bare-column-vs-OUT-variable collision class (a bare
-- `status` or `id` matching a real column name) -- cheaper to make the
-- naming convention bulletproof than to keep re-auditing every query.

-- calculateMatchResult(): derives home_score/away_score from
-- match_events (an own_goal counts for the OTHER team) and recomputes
-- player_match_stats for this match. The score itself is a statistic,
-- same as everything else -- never manually entered, per the spec's
-- one-directional data flow rule.
create function calculate_match_result(p_match_id uuid)
returns void as $$
declare
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_home_score int;
  v_away_score int;
begin
  select matches.home_team_id, matches.away_team_id
  into v_home_team_id, v_away_team_id
  from matches where matches.id = p_match_id;

  select
    coalesce(sum(case
      when event_type = 'goal' and team_id = v_home_team_id then 1
      when event_type = 'own_goal' and team_id = v_away_team_id then 1
      else 0
    end), 0),
    coalesce(sum(case
      when event_type = 'goal' and team_id = v_away_team_id then 1
      when event_type = 'own_goal' and team_id = v_home_team_id then 1
      else 0
    end), 0)
  into v_home_score, v_away_score
  from match_events
  where match_id = p_match_id;

  update matches set home_score = v_home_score, away_score = v_away_score
  where matches.id = p_match_id;

  delete from player_match_stats where match_id = p_match_id;

  insert into player_match_stats (match_id, player_id, goals, own_goals, yellow_cards, red_cards)
  select
    p_match_id,
    player_id,
    count(*) filter (where event_type = 'goal'),
    count(*) filter (where event_type = 'own_goal'),
    count(*) filter (where event_type = 'yellow_card'),
    count(*) filter (where event_type = 'red_card')
  from match_events
  where match_id = p_match_id and player_id is not null
  group by player_id;
end;
$$ language plpgsql security definer;

revoke execute on function calculate_match_result(uuid) from public;

-- calculateCompetitionStats(): recomputes player_competition_stats,
-- team_statistics, and competition_statistics from every published
-- match in the competition. "Appearances" counts distinct matches a
-- player has a lineup entry for, not just ones with an event.
create function calculate_competition_stats(p_competition_id uuid)
returns void as $$
begin
  delete from player_competition_stats where competition_id = p_competition_id;

  insert into player_competition_stats (competition_id, player_id, goals, appearances, yellow_cards, red_cards)
  select
    p_competition_id,
    ml.player_id,
    coalesce(sum(case when me.event_type = 'goal' then 1 else 0 end), 0),
    count(distinct ml.match_id),
    coalesce(sum(case when me.event_type = 'yellow_card' then 1 else 0 end), 0),
    coalesce(sum(case when me.event_type = 'red_card' then 1 else 0 end), 0)
  from match_lineups ml
  join matches m on m.id = ml.match_id
  left join match_events me on me.match_id = ml.match_id and me.player_id = ml.player_id
  where m.competition_id = p_competition_id and m.status = 'published'
  group by ml.player_id;

  delete from team_statistics where competition_id = p_competition_id;

  insert into team_statistics (
    competition_id, team_id, played, won, drawn, lost, goals_for, goals_against, points
  )
  select
    p_competition_id,
    team_id,
    count(*),
    count(*) filter (where result = 'win'),
    count(*) filter (where result = 'draw'),
    count(*) filter (where result = 'loss'),
    sum(goals_for),
    sum(goals_against),
    sum(case when result = 'win' then 3 when result = 'draw' then 1 else 0 end)
  from (
    select
      m.home_team_id as team_id,
      m.home_score as goals_for,
      m.away_score as goals_against,
      case
        when m.home_score > m.away_score then 'win'
        when m.home_score = m.away_score then 'draw'
        else 'loss'
      end as result
    from matches m
    where m.competition_id = p_competition_id and m.status = 'published'
    union all
    select
      m.away_team_id,
      m.away_score,
      m.home_score,
      case
        when m.away_score > m.home_score then 'win'
        when m.away_score = m.home_score then 'draw'
        else 'loss'
      end
    from matches m
    where m.competition_id = p_competition_id and m.status = 'published'
  ) as results
  group by team_id;

  delete from competition_statistics where competition_id = p_competition_id;

  insert into competition_statistics (competition_id, matches_played, total_goals)
  select
    p_competition_id,
    count(*),
    coalesce(sum(home_score + away_score), 0)
  from matches
  where competition_id = p_competition_id and status = 'published';
end;
$$ language plpgsql security definer;

revoke execute on function calculate_competition_stats(uuid) from public;

-- ---------------------------------------------------------------------
-- verifyMatch() / publishMatch(): the minimal manual path only --
-- finished -> verified -> published, immediately, by an organizer (own
-- competition) or platform_admin (any). The Section 7 auto-promotion
-- scheduled job, flagEventDispute()'s pause-the-clock behavior, and the
-- correction_requests workflow are Phase 8 and deliberately not here.
-- Named to match Section 10 exactly so Phase 8 extends these rather
-- than replacing them.
-- ---------------------------------------------------------------------

create function verify_match(p_match_id uuid)
returns void as $$
declare
  v_caller_role user_role;
  v_owns_match boolean;
  v_current_status text;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();

  if v_caller_role = 'organizer' then
    select exists (
      select 1 from matches m
      join competitions c on c.id = m.competition_id
      join organizers o on o.id = c.organizer_id
      where m.id = p_match_id and o.profile_id = auth.uid()
    ) into v_owns_match;

    if not v_owns_match then
      raise exception 'match not found or not owned by caller';
    end if;
  elsif v_caller_role is distinct from 'platform_admin' then
    raise exception 'only an organizer (own competition) or platform_admin may verify a match';
  end if;

  select matches.status into v_current_status from matches where matches.id = p_match_id;
  if v_current_status <> 'finished' then
    raise exception 'match must be finished before it can be verified';
  end if;

  update matches set status = 'verified' where matches.id = p_match_id;

  insert into verification_records (match_id, verified_by, verification_type)
  values (p_match_id, auth.uid(), 'manual');
end;
$$ language plpgsql security definer;

revoke execute on function verify_match(uuid) from public;
grant execute on function verify_match(uuid) to authenticated;

create function publish_match(p_match_id uuid)
returns void as $$
declare
  v_caller_role user_role;
  v_owns_match boolean;
  v_current_status text;
  v_competition_id uuid;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();

  if v_caller_role = 'organizer' then
    select exists (
      select 1 from matches m
      join competitions c on c.id = m.competition_id
      join organizers o on o.id = c.organizer_id
      where m.id = p_match_id and o.profile_id = auth.uid()
    ) into v_owns_match;

    if not v_owns_match then
      raise exception 'match not found or not owned by caller';
    end if;
  elsif v_caller_role is distinct from 'platform_admin' then
    raise exception 'only an organizer (own competition) or platform_admin may publish a match';
  end if;

  select matches.status, matches.competition_id
  into v_current_status, v_competition_id
  from matches where matches.id = p_match_id;

  if v_current_status <> 'verified' then
    raise exception 'match must be verified before it can be published';
  end if;

  perform calculate_match_result(p_match_id);

  update matches set status = 'published' where matches.id = p_match_id;

  perform calculate_competition_stats(v_competition_id);
end;
$$ language plpgsql security definer;

revoke execute on function publish_match(uuid) from public;
grant execute on function publish_match(uuid) to authenticated;
