-- Assists: real gap flagged during Phase 12 (scout cards showed goals
-- only, no assists field ever existed) and now confirmed missing on
-- the public player page too. Additive to the existing goal-counting
-- pipeline, not a new mechanism -- same event -> match stat ->
-- competition stat aggregation, one more event_type and one more
-- summed column at each stage.

alter table match_events drop constraint match_events_event_type_check;
alter table match_events add constraint match_events_event_type_check
  check (event_type in ('goal', 'own_goal', 'assist', 'yellow_card', 'red_card', 'substitution_in', 'substitution_out', 'correction'));

alter table player_match_stats add column assists int not null default 0;
alter table player_competition_stats add column assists int not null default 0;

create or replace function calculate_match_result(p_match_id uuid)
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
  where match_id = p_match_id
    and id not in (
      select compensates_event_id from match_events
      where compensates_event_id is not null
    );

  update matches set home_score = v_home_score, away_score = v_away_score
  where matches.id = p_match_id;

  delete from player_match_stats where match_id = p_match_id;

  insert into player_match_stats (match_id, player_id, goals, own_goals, assists, yellow_cards, red_cards)
  select
    p_match_id,
    player_id,
    count(*) filter (where event_type = 'goal'),
    count(*) filter (where event_type = 'own_goal'),
    count(*) filter (where event_type = 'assist'),
    count(*) filter (where event_type = 'yellow_card'),
    count(*) filter (where event_type = 'red_card')
  from match_events
  where match_id = p_match_id and player_id is not null
    and id not in (
      select compensates_event_id from match_events
      where compensates_event_id is not null
    )
  group by player_id;
end;
$$ language plpgsql security definer;

create or replace function calculate_competition_stats(p_competition_id uuid)
returns void as $$
begin
  delete from player_competition_stats where competition_id = p_competition_id;

  insert into player_competition_stats (competition_id, player_id, goals, appearances, assists, yellow_cards, red_cards)
  select
    p_competition_id,
    ml.player_id,
    coalesce(sum(case when me.event_type = 'goal' then 1 else 0 end), 0),
    count(distinct ml.match_id),
    coalesce(sum(case when me.event_type = 'assist' then 1 else 0 end), 0),
    coalesce(sum(case when me.event_type = 'yellow_card' then 1 else 0 end), 0),
    coalesce(sum(case when me.event_type = 'red_card' then 1 else 0 end), 0)
  from match_lineups ml
  join matches m on m.id = ml.match_id
  left join match_events me
    on me.match_id = ml.match_id and me.player_id = ml.player_id
    and me.id not in (
      select compensates_event_id from match_events where compensates_event_id is not null
    )
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

-- record_match_event(): Match Center channel only -- the WhatsApp
-- channel's event vocabulary (GOAL/OWNGOAL/YELLOW/RED) is untouched,
-- out of scope for this pass.
create or replace function record_match_event(
  p_match_id uuid,
  p_player_id uuid,
  p_event_type text,
  p_minute int,
  p_dedup_key uuid default null
)
returns void as $$
declare
  v_is_operator boolean;
  v_status text;
  v_lineup_team_id uuid;
begin
  select exists (
    select 1 from matches m
    where m.id = p_match_id and m.assigned_operator_profile_id = auth.uid()
  ) into v_is_operator;

  if not v_is_operator then
    raise exception 'only the assigned match operator may record events for this match';
  end if;

  select matches.status into v_status from matches where matches.id = p_match_id;
  if v_status <> 'in_progress' then
    raise exception 'match is not in progress';
  end if;

  if p_event_type not in ('goal', 'own_goal', 'assist', 'yellow_card', 'red_card') then
    raise exception 'unsupported event type for this entry point';
  end if;

  select ml.team_id into v_lineup_team_id
  from match_lineups ml
  where ml.match_id = p_match_id and ml.player_id = p_player_id;

  if v_lineup_team_id is null then
    raise exception 'player is not on the lineup for this match';
  end if;

  begin
    insert into match_events (match_id, player_id, team_id, event_type, minute, source, recorded_by, dedup_key)
    values (p_match_id, p_player_id, v_lineup_team_id, p_event_type, p_minute, 'match_center', auth.uid(), p_dedup_key::text);
  exception when unique_violation then
    return;
  end;
end;
$$ language plpgsql security definer;
