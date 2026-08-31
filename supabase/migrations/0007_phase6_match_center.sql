-- Phase 6: Match Center + WhatsApp bot. Two channels feeding the same
-- append-only match_events table.
--
-- Every new function here returns void (no implicit OUT variables, so
-- the Phase 4 bare-column bug class can't recur) except
-- record_match_event_from_whatsapp, whose OUT columns are deliberately
-- prefixed result_* so they can never collide with a real table column
-- name. Every column reference is still table-qualified regardless.

-- ---------------------------------------------------------------------
-- Prerequisites this phase needs that didn't exist before: a way for
-- someone to be a match_operator at all (reversing the Phase 1 call to
-- exclude it from self-registration -- building a full invite/promotion
-- system instead would be disproportionate for a lightweight volunteer
-- role), a way for an organizer to find match_operator accounts to
-- assign (profiles RLS only ever allowed reading your own row), a way
-- to assign one to a specific fixture, and a WhatsApp-number-to-account
-- mapping for the bot to identify who's texting.
-- ---------------------------------------------------------------------

alter table profiles add column whatsapp_number text unique;

create policy "Anyone authenticated can view match_operator profiles"
  on profiles for select
  to authenticated
  using (role = 'match_operator');

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, whatsapp_number)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'player'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'whatsapp_number'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

alter table matches add column assigned_operator_profile_id uuid references profiles (id);

-- assignMatchOperator(): organizer-only, must own the fixture's
-- competition, target profile must actually be a match_operator.
create function assign_match_operator(p_match_id uuid, p_operator_profile_id uuid)
returns void as $$
declare
  caller_role user_role;
  owns_match boolean;
  operator_role user_role;
begin
  select role into caller_role from profiles where profiles.id = auth.uid();
  if caller_role is distinct from 'organizer' then
    raise exception 'only an organizer may assign a match operator';
  end if;

  select exists (
    select 1 from matches m
    join competitions c on c.id = m.competition_id
    join organizers o on o.id = c.organizer_id
    where m.id = p_match_id and o.profile_id = auth.uid()
  ) into owns_match;

  if not owns_match then
    raise exception 'match not found or not owned by caller';
  end if;

  select role into operator_role from profiles where profiles.id = p_operator_profile_id;
  if operator_role is distinct from 'match_operator' then
    raise exception 'target profile is not a match_operator';
  end if;

  update matches set assigned_operator_profile_id = p_operator_profile_id
  where matches.id = p_match_id;
end;
$$ language plpgsql security definer;

revoke execute on function assign_match_operator(uuid, uuid) from public;
grant execute on function assign_match_operator(uuid, uuid) to authenticated;

-- setMatchLineup(): the assigned operator only. Every player must be on
-- that team's active roster (team_players). Replaces any lineup already
-- set for that team+match, so it can be corrected before kickoff.
create function set_match_lineup(p_match_id uuid, p_team_id uuid, p_player_ids uuid[])
returns void as $$
declare
  is_operator boolean;
  is_home_or_away boolean;
  invalid_count int;
begin
  select exists (
    select 1 from matches m
    where m.id = p_match_id and m.assigned_operator_profile_id = auth.uid()
  ) into is_operator;

  if not is_operator then
    raise exception 'only the assigned match operator may set the lineup';
  end if;

  select exists (
    select 1 from matches m
    where m.id = p_match_id and (m.home_team_id = p_team_id or m.away_team_id = p_team_id)
  ) into is_home_or_away;

  if not is_home_or_away then
    raise exception 'team is not part of this fixture';
  end if;

  select count(*) into invalid_count
  from unnest(p_player_ids) as pid
  where not exists (
    select 1 from team_players tp
    where tp.team_id = p_team_id and tp.player_id = pid and tp.left_at is null
  );

  if invalid_count > 0 then
    raise exception 'one or more players are not on this team''s active roster';
  end if;

  delete from match_lineups where match_id = p_match_id and team_id = p_team_id;

  insert into match_lineups (match_id, player_id, team_id, is_starting)
  select p_match_id, pid, p_team_id, true from unnest(p_player_ids) as pid;
end;
$$ language plpgsql security definer;

revoke execute on function set_match_lineup(uuid, uuid, uuid[]) from public;
grant execute on function set_match_lineup(uuid, uuid, uuid[]) to authenticated;

-- startMatch(): assigned operator only, scheduled -> in_progress.
create function start_match(p_match_id uuid)
returns void as $$
declare
  is_operator boolean;
  current_status text;
begin
  select exists (
    select 1 from matches m
    where m.id = p_match_id and m.assigned_operator_profile_id = auth.uid()
  ) into is_operator;

  if not is_operator then
    raise exception 'only the assigned match operator may start this match';
  end if;

  select m.status into current_status from matches m where m.id = p_match_id;
  if current_status <> 'scheduled' then
    raise exception 'match is not in scheduled status';
  end if;

  update matches set status = 'in_progress' where matches.id = p_match_id;
end;
$$ language plpgsql security definer;

revoke execute on function start_match(uuid) from public;
grant execute on function start_match(uuid) to authenticated;

-- recordMatchEvent(): the Match Center UI channel. Assigned operator
-- only, match must be in progress, player must be on this match's
-- lineup -- the same eligibility rule the WhatsApp channel enforces
-- below, so both channels feed match_events under one set of rules.
create function record_match_event(
  p_match_id uuid,
  p_player_id uuid,
  p_event_type text,
  p_minute int
)
returns void as $$
declare
  is_operator boolean;
  current_status text;
  lineup_team_id uuid;
begin
  select exists (
    select 1 from matches m
    where m.id = p_match_id and m.assigned_operator_profile_id = auth.uid()
  ) into is_operator;

  if not is_operator then
    raise exception 'only the assigned match operator may record events for this match';
  end if;

  select m.status into current_status from matches m where m.id = p_match_id;
  if current_status <> 'in_progress' then
    raise exception 'match is not in progress';
  end if;

  if p_event_type not in ('goal', 'own_goal', 'yellow_card', 'red_card') then
    raise exception 'unsupported event type for this entry point';
  end if;

  select ml.team_id into lineup_team_id
  from match_lineups ml
  where ml.match_id = p_match_id and ml.player_id = p_player_id;

  if lineup_team_id is null then
    raise exception 'player is not on the lineup for this match';
  end if;

  insert into match_events (match_id, player_id, team_id, event_type, minute, source, recorded_by)
  values (p_match_id, p_player_id, lineup_team_id, p_event_type, p_minute, 'match_center', auth.uid());
end;
$$ language plpgsql security definer;

revoke execute on function record_match_event(uuid, uuid, text, int) from public;
grant execute on function record_match_event(uuid, uuid, text, int) to authenticated;

-- finishMatch(): assigned operator only, in_progress -> finished, and
-- starts the Section 7 auto-verify clock (72h, within the spec's
-- documented 48-72h range). The scheduled promotion job and manual
-- verifyMatch()/publishMatch() are Phase 8 -- this just starts the
-- clock, matching how Phase 5 populated auto_verify_at's sibling data
-- without building the phase that consumes it.
create function finish_match(p_match_id uuid)
returns void as $$
declare
  is_operator boolean;
  current_status text;
begin
  select exists (
    select 1 from matches m
    where m.id = p_match_id and m.assigned_operator_profile_id = auth.uid()
  ) into is_operator;

  if not is_operator then
    raise exception 'only the assigned match operator may finish this match';
  end if;

  select m.status into current_status from matches m where m.id = p_match_id;
  if current_status <> 'in_progress' then
    raise exception 'match is not in progress';
  end if;

  update matches
  set status = 'finished', auto_verify_at = now() + interval '72 hours'
  where matches.id = p_match_id;
end;
$$ language plpgsql security definer;

revoke execute on function finish_match(uuid) from public;
grant execute on function finish_match(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- WhatsApp channel. Idempotency via a unique provider_message_id: a
-- retried webhook delivery for a message already processed hits the
-- unique_violation branch and returns success without a second insert,
-- rather than double-recording the event.
-- ---------------------------------------------------------------------

alter table match_events add column provider_message_id text unique;

-- Called only from the webhook route's service-role client -- there is
-- no Supabase Auth session on an inbound WhatsApp message, so this
-- takes the sender's number as an explicit parameter instead of using
-- auth.uid(), and is granted to service_role only, never authenticated.
create function record_match_event_from_whatsapp(
  p_sender_whatsapp_number text,
  p_player_identifier text,
  p_event_type text,
  p_minute int,
  p_provider_message_id text
)
returns table (result_status text, result_message text, result_match_id uuid) as $$
declare
  operator_profile_id uuid;
  active_match_id uuid;
  target_player_id uuid;
  target_team_id uuid;
begin
  select profiles.id into operator_profile_id from profiles
  where profiles.whatsapp_number = p_sender_whatsapp_number and profiles.role = 'match_operator';

  if operator_profile_id is null then
    return query select
      'error'::text,
      'This WhatsApp number is not registered as a match operator.'::text,
      null::uuid;
    return;
  end if;

  select matches.id into active_match_id from matches
  where matches.assigned_operator_profile_id = operator_profile_id
    and matches.status = 'in_progress'
  limit 1;

  if active_match_id is null then
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
      active_match_id;
    return;
  end if;

  select players.id, match_lineups.team_id into target_player_id, target_team_id
  from players
  join football_ids on football_ids.id = players.football_id_id
  join match_lineups on match_lineups.player_id = players.id and match_lineups.match_id = active_match_id
  where football_ids.code = p_player_identifier;

  if target_player_id is null then
    return query select
      'error'::text,
      'That player is not on the lineup for your active match.'::text,
      active_match_id;
    return;
  end if;

  begin
    insert into match_events (
      match_id, player_id, team_id, event_type, minute, source, recorded_by, provider_message_id
    )
    values (
      active_match_id, target_player_id, target_team_id, p_event_type, p_minute,
      'whatsapp_bot', operator_profile_id, p_provider_message_id
    );
  exception when unique_violation then
    return query select
      'ok'::text,
      'Already recorded (duplicate delivery ignored).'::text,
      active_match_id;
    return;
  end;

  return query select 'ok'::text, 'Recorded.'::text, active_match_id;
end;
$$ language plpgsql security definer;

revoke execute on function record_match_event_from_whatsapp(text, text, text, int, text) from public;
grant execute on function record_match_event_from_whatsapp(text, text, text, int, text) to service_role;
