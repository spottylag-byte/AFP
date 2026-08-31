-- Phase 8: the real trust hierarchy on top of Phase 7's minimal manual
-- verify_match()/publish_match() -- auto-promotion, dispute flagging,
-- and the correction-request workflow. All locals stay v_-prefixed,
-- per the Phase 4/7 discipline.

-- ---------------------------------------------------------------------
-- Fix: set_match_lineup() never checked match status, so a lineup could
-- still be silently rewritten after the match was published -- directly
-- violates the Section 9 "published match cannot be silently modified"
-- test case. Same signature, so a straight CREATE OR REPLACE.
-- ---------------------------------------------------------------------

create or replace function set_match_lineup(p_match_id uuid, p_team_id uuid, p_player_ids uuid[])
returns void as $$
declare
  v_is_operator boolean;
  v_is_home_or_away boolean;
  v_status text;
  v_invalid_count int;
begin
  select exists (
    select 1 from matches m
    where m.id = p_match_id and m.assigned_operator_profile_id = auth.uid()
  ) into v_is_operator;

  if not v_is_operator then
    raise exception 'only the assigned match operator may set the lineup';
  end if;

  select matches.status into v_status from matches where matches.id = p_match_id;
  if v_status not in ('scheduled', 'in_progress') then
    raise exception 'lineup can only be set before a match is finished';
  end if;

  select exists (
    select 1 from matches m
    where m.id = p_match_id and (m.home_team_id = p_team_id or m.away_team_id = p_team_id)
  ) into v_is_home_or_away;

  if not v_is_home_or_away then
    raise exception 'team is not part of this fixture';
  end if;

  select count(*) into v_invalid_count
  from unnest(p_player_ids) as pid
  where not exists (
    select 1 from team_players tp
    where tp.team_id = p_team_id and tp.player_id = pid and tp.left_at is null
  );

  if v_invalid_count > 0 then
    raise exception 'one or more players are not on this team''s active roster';
  end if;

  delete from match_lineups where match_id = p_match_id and team_id = p_team_id;

  insert into match_lineups (match_id, player_id, team_id, is_starting)
  select p_match_id, pid, p_team_id, true from unnest(p_player_ids) as pid;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- Fix: add_existing_player_to_team() -- the closest thing this schema
-- has to a "merge decision" -- never wrote to audit_logs, despite
-- Section 5 explicitly requiring every merge decision to be logged.
-- ---------------------------------------------------------------------

create or replace function add_existing_player_to_team(p_team_id uuid, p_player_id uuid)
returns void as $$
declare
  v_caller_role user_role;
  v_owns_team boolean;
  v_already_active boolean;
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'team_manager' then
    raise exception 'only a team_manager may add a player to a roster';
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
-- Idempotency for the Match Center UI channel too, generalizing the
-- WhatsApp-only mechanism from Phase 6. Renamed to a channel-neutral
-- name since it's no longer Twilio-specific.
-- ---------------------------------------------------------------------

alter table match_events rename column provider_message_id to dedup_key;

drop function record_match_event_from_whatsapp(text, text, text, int, text);
drop function record_match_event(uuid, uuid, text, int);

create function record_match_event(
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

  if p_event_type not in ('goal', 'own_goal', 'yellow_card', 'red_card') then
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
    return; -- already recorded (resubmission) -- not an error
  end;
end;
$$ language plpgsql security definer;

revoke execute on function record_match_event(uuid, uuid, text, int, uuid) from public;
grant execute on function record_match_event(uuid, uuid, text, int, uuid) to authenticated;

create function record_match_event_from_whatsapp(
  p_sender_whatsapp_number text,
  p_player_identifier text,
  p_event_type text,
  p_minute int,
  p_dedup_key text
)
returns table (result_status text, result_message text, result_match_id uuid) as $$
declare
  v_operator_profile_id uuid;
  v_active_match_id uuid;
  v_target_player_id uuid;
  v_target_team_id uuid;
begin
  select profiles.id into v_operator_profile_id from profiles
  where profiles.whatsapp_number = p_sender_whatsapp_number and profiles.role = 'match_operator';

  if v_operator_profile_id is null then
    return query select
      'error'::text,
      'This WhatsApp number is not registered as a match operator.'::text,
      null::uuid;
    return;
  end if;

  select matches.id into v_active_match_id from matches
  where matches.assigned_operator_profile_id = v_operator_profile_id
    and matches.status = 'in_progress'
  limit 1;

  if v_active_match_id is null then
    return query select
      'error'::text,
      'You have no match currently in progress.'::text,
      null::uuid;
    return;
  end if;

  if p_event_type not in ('goal', 'own_goal', 'yellow_card', 'red_card') then
    return query select
      'error'::text,
      'Unrecognized event type. Use GOAL, OWNGOAL, YELLOW, or RED.'::text,
      v_active_match_id;
    return;
  end if;

  select players.id, match_lineups.team_id into v_target_player_id, v_target_team_id
  from players
  join football_ids on football_ids.id = players.football_id_id
  join match_lineups on match_lineups.player_id = players.id and match_lineups.match_id = v_active_match_id
  where football_ids.code = p_player_identifier;

  if v_target_player_id is null then
    return query select
      'error'::text,
      'That player is not on the lineup for your active match.'::text,
      v_active_match_id;
    return;
  end if;

  begin
    insert into match_events (
      match_id, player_id, team_id, event_type, minute, source, recorded_by, dedup_key
    )
    values (
      v_active_match_id, v_target_player_id, v_target_team_id, p_event_type, p_minute,
      'whatsapp_bot', v_operator_profile_id, p_dedup_key
    );
  exception when unique_violation then
    return query select
      'ok'::text,
      'Already recorded (duplicate delivery ignored).'::text,
      v_active_match_id;
    return;
  end;

  return query select 'ok'::text, 'Recorded.'::text, v_active_match_id;
end;
$$ language plpgsql security definer;

revoke execute on function record_match_event_from_whatsapp(text, text, text, int, text) from public;
grant execute on function record_match_event_from_whatsapp(text, text, text, int, text) to service_role;

-- ---------------------------------------------------------------------
-- Corrections must exclude what they compensate for from every stat/
-- score aggregation -- otherwise "never edit history in place" would
-- still double-count the original. Same signatures, CREATE OR REPLACE.
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- Internal helpers shared by the manual path (verify_match/
-- publish_match) and auto-promotion, so both converge on identical
-- behaviour -- per Section 7 point 4, "both paths converge on the same
-- MATCH_VERIFIED state."
-- ---------------------------------------------------------------------

create function do_verify_match(p_match_id uuid, p_verified_by uuid, p_verification_type text)
returns void as $$
begin
  update matches set status = 'verified' where matches.id = p_match_id;

  insert into verification_records (match_id, verified_by, verification_type)
  values (p_match_id, p_verified_by, p_verification_type);

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    p_verified_by,
    'match_verified',
    'matches',
    p_match_id,
    jsonb_build_object('verification_type', p_verification_type)
  );
end;
$$ language plpgsql security definer;

revoke execute on function do_verify_match(uuid, uuid, text) from public;

create function do_publish_match(p_match_id uuid)
returns void as $$
declare
  v_competition_id uuid;
begin
  select matches.competition_id into v_competition_id from matches where matches.id = p_match_id;

  perform calculate_match_result(p_match_id);

  update matches set status = 'published' where matches.id = p_match_id;

  perform calculate_competition_stats(v_competition_id);
end;
$$ language plpgsql security definer;

revoke execute on function do_publish_match(uuid) from public;

create or replace function verify_match(p_match_id uuid)
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

  perform do_verify_match(p_match_id, auth.uid(), 'manual');
end;
$$ language plpgsql security definer;

create or replace function publish_match(p_match_id uuid)
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
    raise exception 'only an organizer (own competition) or platform_admin may publish a match';
  end if;

  select matches.status into v_current_status from matches where matches.id = p_match_id;
  if v_current_status <> 'verified' then
    raise exception 'match must be verified before it can be published';
  end if;

  perform do_publish_match(p_match_id);
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------
-- Dispute + correction workflow.
-- ---------------------------------------------------------------------

create policy "Organizer can view correction_requests for own competitions"
  on correction_requests for select
  to authenticated
  using (
    exists (
      select 1 from match_events me
      join matches m on m.id = me.match_id
      join competitions c on c.id = m.competition_id
      join organizers o on o.id = c.organizer_id
      where me.id = correction_requests.match_event_id and o.profile_id = auth.uid()
    )
  );

-- requestCorrection(): the full workflow entry point, with optional
-- evidence. flagEventDispute() below is the lightweight version Section
-- 7 describes -- same underlying row, no evidence required.
create function request_correction(p_event_id uuid, p_reason text, p_evidence_url text default null)
returns uuid as $$
declare
  v_caller_role user_role;
  v_new_id uuid;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();
  if v_caller_role not in ('player', 'team_manager', 'organizer', 'platform_admin') then
    raise exception 'this role may not request a correction';
  end if;

  if not exists (select 1 from match_events where match_events.id = p_event_id) then
    raise exception 'match event not found';
  end if;

  insert into correction_requests (match_event_id, requested_by, reason, evidence_url, status)
  values (p_event_id, auth.uid(), p_reason, p_evidence_url, 'pending')
  returning id into v_new_id;

  return v_new_id;
end;
$$ language plpgsql security definer;

revoke execute on function request_correction(uuid, text, text) from public;
grant execute on function request_correction(uuid, text, text) to authenticated;

create function flag_event_dispute(p_event_id uuid, p_reason text)
returns void as $$
begin
  perform request_correction(p_event_id, p_reason, null);
end;
$$ language plpgsql security definer;

revoke execute on function flag_event_dispute(uuid, text) from public;
grant execute on function flag_event_dispute(uuid, text) to authenticated;

-- approveCorrection(): inserts a compensating event pointing at the one
-- it corrects (never edits history), then recalculates. Passing a
-- corrected event type replaces the original's effect; passing null
-- voids it with no replacement (a bare 'correction' event, which no
-- stat aggregation counts).
create function approve_correction(
  p_correction_request_id uuid,
  p_corrected_event_type text default null,
  p_corrected_player_id uuid default null,
  p_corrected_minute int default null,
  p_review_notes text default null
)
returns void as $$
declare
  v_caller_role user_role;
  v_can_review boolean;
  v_status text;
  v_original_event_id uuid;
  v_match_id uuid;
  v_original_player_id uuid;
  v_original_minute int;
  v_team_id uuid;
  v_new_event_id uuid;
begin
  select role into v_caller_role from profiles where profiles.id = auth.uid();

  select exists (
    select 1 from correction_requests cr
    join match_events me on me.id = cr.match_event_id
    join matches m on m.id = me.match_id
    join competitions c on c.id = m.competition_id
    join organizers o on o.id = c.organizer_id
    where cr.id = p_correction_request_id and o.profile_id = auth.uid()
  ) into v_can_review;

  if not (v_can_review or v_caller_role = 'platform_admin') then
    raise exception 'only the owning organizer or platform_admin may approve a correction';
  end if;

  select correction_requests.status, correction_requests.match_event_id
  into v_status, v_original_event_id
  from correction_requests where correction_requests.id = p_correction_request_id;

  if v_status not in ('pending', 'escalated') then
    raise exception 'correction request is not open';
  end if;

  select match_events.match_id, match_events.player_id, match_events.minute
  into v_match_id, v_original_player_id, v_original_minute
  from match_events where match_events.id = v_original_event_id;

  if p_corrected_event_type is not null then
    select ml.team_id into v_team_id
    from match_lineups ml
    where ml.match_id = v_match_id
      and ml.player_id = coalesce(p_corrected_player_id, v_original_player_id);

    if v_team_id is null then
      raise exception 'corrected player is not on this match''s lineup';
    end if;

    insert into match_events (
      match_id, player_id, team_id, event_type, minute, source, recorded_by, compensates_event_id
    )
    values (
      v_match_id,
      coalesce(p_corrected_player_id, v_original_player_id),
      v_team_id,
      p_corrected_event_type,
      coalesce(p_corrected_minute, v_original_minute),
      'match_center',
      auth.uid(),
      v_original_event_id
    )
    returning id into v_new_event_id;
  else
    insert into match_events (match_id, event_type, source, recorded_by, compensates_event_id)
    values (v_match_id, 'correction', 'match_center', auth.uid(), v_original_event_id)
    returning id into v_new_event_id;
  end if;

  update correction_requests
  set status = 'approved',
      reviewed_by = auth.uid(),
      review_notes = p_review_notes,
      resulting_event_id = v_new_event_id,
      reviewed_at = now()
  where correction_requests.id = p_correction_request_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'correction_approved',
    'match_events',
    v_original_event_id,
    jsonb_build_object('correction_request_id', p_correction_request_id, 'resulting_event_id', v_new_event_id)
  );

  perform calculate_match_result(v_match_id);
  perform calculate_competition_stats(
    (select matches.competition_id from matches where matches.id = v_match_id)
  );
end;
$$ language plpgsql security definer;

revoke execute on function approve_correction(uuid, text, uuid, int, text) from public;
grant execute on function approve_correction(uuid, text, uuid, int, text) to authenticated;

create function reject_correction(p_correction_request_id uuid, p_review_notes text)
returns void as $$
declare
  v_caller_role user_role;
  v_can_review boolean;
  v_status text;
begin
  if p_review_notes is null or length(trim(p_review_notes)) = 0 then
    raise exception 'a reason is required to reject a correction';
  end if;

  select role into v_caller_role from profiles where profiles.id = auth.uid();

  select exists (
    select 1 from correction_requests cr
    join match_events me on me.id = cr.match_event_id
    join matches m on m.id = me.match_id
    join competitions c on c.id = m.competition_id
    join organizers o on o.id = c.organizer_id
    where cr.id = p_correction_request_id and o.profile_id = auth.uid()
  ) into v_can_review;

  if not (v_can_review or v_caller_role = 'platform_admin') then
    raise exception 'only the owning organizer or platform_admin may reject a correction';
  end if;

  select correction_requests.status into v_status
  from correction_requests where correction_requests.id = p_correction_request_id;

  if v_status not in ('pending', 'escalated') then
    raise exception 'correction request is not open';
  end if;

  update correction_requests
  set status = 'rejected', reviewed_by = auth.uid(), review_notes = p_review_notes, reviewed_at = now()
  where correction_requests.id = p_correction_request_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    auth.uid(),
    'correction_rejected',
    'correction_requests',
    p_correction_request_id,
    jsonb_build_object('review_notes', p_review_notes)
  );
end;
$$ language plpgsql security definer;

revoke execute on function reject_correction(uuid, text) from public;
grant execute on function reject_correction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- autoPromoteUnverifiedMatches(): the scheduled job. System-initiated,
-- no auth.uid() -- verified_by is null, verification_type is
-- 'auto_promoted'. Skips any match with an open dispute, which is what
-- "pauses the clock" actually means here: it's just excluded from this
-- query until the dispute resolves.
-- ---------------------------------------------------------------------

create function auto_promote_unverified_matches()
returns int as $$
declare
  v_match record;
  v_count int := 0;
begin
  for v_match in
    select m.id from matches m
    where m.status = 'finished'
      and m.auto_verify_at is not null
      and m.auto_verify_at < now()
      and not exists (
        select 1 from correction_requests cr
        join match_events me on me.id = cr.match_event_id
        where me.match_id = m.id and cr.status in ('pending', 'escalated')
      )
  loop
    perform do_verify_match(v_match.id, null, 'auto_promoted');
    perform do_publish_match(v_match.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$ language plpgsql security definer;

revoke execute on function auto_promote_unverified_matches() from public;

create extension if not exists pg_cron;

select cron.schedule(
  'auto-promote-unverified-matches',
  '*/15 * * * *',
  $$select auto_promote_unverified_matches()$$
);
