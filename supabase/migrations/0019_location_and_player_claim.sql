-- Two independent additions:
--
-- 1. Location: scouts need to search across countries/cities, and
-- nothing in the schema captured where a player is based. Two plain
-- optional text fields (not a country-code enum) -- grassroots players
-- span states/cities that don't need a controlled vocabulary yet.
--
-- 2. Player profile claim + media confirmation: the spec's Player role
-- has always included "own profile claim" (Section 4) but nothing ever
-- built it. A player claims their own row by Football ID code (already
-- public-facing on their profile page) and can then confirm a photo or
-- video someone else uploaded is genuinely them -- the upload right
-- itself stays with team_manager/organizer/admin exactly as before,
-- this only adds a player-side acknowledgement flag.

alter table players add column country text;
alter table players add column city text;
alter table players add column photo_confirmed_by_player boolean not null default false;
alter table player_videos add column confirmed_by_player boolean not null default false;

-- register_player() gains two optional params. Signature change -> drop+create.
drop function register_player(text, text, date, uuid, text, text, int, text);

create function register_player(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_team_id uuid default null,
  p_alias text default null,
  p_position text default null,
  p_height_cm int default null,
  p_preferred_foot text default null,
  p_country text default null,
  p_city text default null
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

  if p_position is not null and p_position not in ('GK', 'DEF', 'MID', 'FWD') then
    raise exception 'invalid position: %', p_position;
  end if;

  if p_preferred_foot is not null and p_preferred_foot not in ('left', 'right', 'both') then
    raise exception 'invalid preferred_foot: %', p_preferred_foot;
  end if;

  if p_height_cm is not null and (p_height_cm < 100 or p_height_cm > 230) then
    raise exception 'invalid height_cm: %', p_height_cm;
  end if;

  v_new_football_id_id := create_football_id();

  insert into players
    (football_id_id, first_name, last_name, alias, date_of_birth, position, height_cm, preferred_foot, country, city, created_by)
  values
    (v_new_football_id_id, p_first_name, p_last_name, p_alias, p_date_of_birth, p_position, p_height_cm, p_preferred_foot, p_country, p_city, auth.uid())
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
      'position', p_position,
      'height_cm', p_height_cm,
      'preferred_foot', p_preferred_foot,
      'country', p_country,
      'city', p_city,
      'football_id', v_new_code,
      'team_id', p_team_id
    )
  );

  return query select v_new_player_id, v_new_code;
end;
$$ language plpgsql security definer;

revoke execute on function register_player(text, text, date, uuid, text, text, int, text, text, text) from public;
grant execute on function register_player(text, text, date, uuid, text, text, int, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- claimPlayerProfile(): self-service, player role only. First-come:
-- once a players row has a profile_id, it can't be re-claimed. Uses
-- the Football ID code, already public on the player's own page, as
-- the claim key -- a team/organizer/admin would hand this to the real
-- player when registering them.
-- ---------------------------------------------------------------------

create function claim_player_profile(p_football_id_code text)
returns uuid as $$
declare
  v_caller_role user_role;
  v_player_id uuid;
  v_already_claimed uuid;
begin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role is distinct from 'player' then
    raise exception 'only a player account may claim a player profile';
  end if;

  select players.id, players.profile_id into v_player_id, v_already_claimed
  from players
  join football_ids on football_ids.id = players.football_id_id
  where football_ids.code = p_football_id_code;

  if v_player_id is null then
    raise exception 'no player found with that Football ID';
  end if;

  if v_already_claimed is not null then
    raise exception 'this player profile has already been claimed';
  end if;

  update players set profile_id = auth.uid() where id = v_player_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'player_profile_claimed', 'players', v_player_id, jsonb_build_object('football_id', p_football_id_code));

  return v_player_id;
end;
$$ language plpgsql security definer;

revoke execute on function claim_player_profile(text) from public;
grant execute on function claim_player_profile(text) to authenticated;

-- confirmPlayerPhoto()/confirmPlayerVideo(): the claiming player only,
-- confirming media someone else uploaded is genuinely them. Does not
-- grant upload/delete rights -- those stay with whoever already had
-- them (set_player_photo/add_player_video/remove_player_video).

create function confirm_player_photo(p_player_id uuid)
returns void as $$
begin
  if not exists (select 1 from players where id = p_player_id and profile_id = auth.uid()) then
    raise exception 'you may only confirm your own claimed profile''s photo';
  end if;

  update players set photo_confirmed_by_player = true where id = p_player_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'player_photo_confirmed', 'players', p_player_id, '{}'::jsonb);
end;
$$ language plpgsql security definer;

revoke execute on function confirm_player_photo(uuid) from public;
grant execute on function confirm_player_photo(uuid) to authenticated;

create function confirm_player_video(p_video_id uuid)
returns void as $$
declare
  v_player_id uuid;
begin
  select player_id into v_player_id from player_videos where id = p_video_id;
  if v_player_id is null then
    raise exception 'video not found';
  end if;

  if not exists (select 1 from players where id = v_player_id and profile_id = auth.uid()) then
    raise exception 'you may only confirm your own claimed profile''s video';
  end if;

  update player_videos set confirmed_by_player = true where id = p_video_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'player_video_confirmed', 'players', v_player_id, jsonb_build_object('video_id', p_video_id));
end;
$$ language plpgsql security definer;

revoke execute on function confirm_player_video(uuid) from public;
grant execute on function confirm_player_video(uuid) to authenticated;
