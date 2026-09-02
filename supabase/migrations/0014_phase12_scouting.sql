-- Phase 12: Scouting. DoD per the master spec: "a realistic scout query
-- returns relevant results." Read-only against data that's already
-- verified by construction: player_competition_stats only ever gets
-- rows written when a match is published (Phase 7), so nothing here
-- needs a separate trust filter -- searching it is inherently
-- searching verified data.
--
-- players.position is new: nothing in the schema captured it before,
-- and no scout search is realistic without it. Nullable/optional --
-- existing players and existing registration flows keep working
-- unchanged.

alter table players add column position text
  check (position is null or position in ('GK', 'DEF', 'MID', 'FWD'));
alter table players add column height_cm int check (height_cm is null or (height_cm between 100 and 230));
alter table players add column preferred_foot text
  check (preferred_foot is null or preferred_foot in ('left', 'right', 'both'));

-- ---------------------------------------------------------------------
-- register_player() gains one optional parameter. Signature changes,
-- so DROP + CREATE (not REPLACE) -- same reason every prior
-- register_player() edit in this project has needed it.
-- ---------------------------------------------------------------------

drop function register_player(text, text, date, uuid, text);

create function register_player(
  p_first_name text,
  p_last_name text,
  p_date_of_birth date,
  p_team_id uuid default null,
  p_alias text default null,
  p_position text default null,
  p_height_cm int default null,
  p_preferred_foot text default null
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
    (football_id_id, first_name, last_name, alias, date_of_birth, position, height_cm, preferred_foot, created_by)
  values
    (v_new_football_id_id, p_first_name, p_last_name, p_alias, p_date_of_birth, p_position, p_height_cm, p_preferred_foot, auth.uid())
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
      'football_id', v_new_code,
      'team_id', p_team_id
    )
  );

  return query select v_new_player_id, v_new_code;
end;
$$ language plpgsql security definer;

revoke execute on function register_player(text, text, date, uuid, text, text, int, text) from public;
grant execute on function register_player(text, text, date, uuid, text, text, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- shortlists / shortlist_players: a scout's own low-risk data, no
-- append-only/trust-model concerns (nothing here feeds a public stat).
-- Plain RLS-backed CRUD is enough -- same lightweight pattern as
-- "Organizer can create own organizers row" from Phase 3, no
-- SECURITY DEFINER funnel function needed.
-- ---------------------------------------------------------------------

create table shortlists (
  id uuid primary key default gen_random_uuid(),
  scout_profile_id uuid not null references profiles (id),
  name text not null,
  created_at timestamptz not null default now()
);

alter table shortlists enable row level security;

create policy "Scout can manage own shortlists"
  on shortlists for all
  to authenticated
  using (scout_profile_id = auth.uid())
  with check (
    scout_profile_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'scout')
  );

create table shortlist_players (
  id uuid primary key default gen_random_uuid(),
  shortlist_id uuid not null references shortlists (id) on delete cascade,
  player_id uuid not null references players (id),
  added_at timestamptz not null default now(),
  unique (shortlist_id, player_id)
);

alter table shortlist_players enable row level security;

create policy "Scout can manage own shortlist_players"
  on shortlist_players for all
  to authenticated
  using (
    exists (
      select 1 from shortlists
      where shortlists.id = shortlist_players.shortlist_id
      and shortlists.scout_profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from shortlists
      where shortlists.id = shortlist_players.shortlist_id
      and shortlists.scout_profile_id = auth.uid()
    )
  );
