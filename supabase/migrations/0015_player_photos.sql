-- Player photos: a real headshot instead of only an initials circle,
-- clickable to confirm identity -- the same reason Baobab's profile
-- cards show one. Cosmetic/display data, not a stat, so it sits
-- outside the append-only trust model entirely; the thing that DOES
-- need gating is which player record a photo gets attached to, not
-- the raw storage write itself.

alter table players add column photo_url text;

-- Public bucket -- player photos are already shown on public profile
-- pages alongside name/team, no more sensitive than that. Any
-- authenticated user may upload an object (harmless on its own, a raw
-- file isn't linked to any player until set_player_photo() attaches
-- it); nobody may overwrite or delete another user's upload.
insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', true)
on conflict (id) do nothing;

create policy "Anyone authenticated can upload player photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'player-photos');

create policy "Anyone can view player photos"
  on storage.objects for select
  to public
  using (bucket_id = 'player-photos');

create policy "Uploader can replace or remove their own player photo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'player-photos' and owner = auth.uid());

create policy "Uploader can delete their own player photo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'player-photos' and owner = auth.uid());

-- ---------------------------------------------------------------------
-- setPlayerPhoto(): the actual gate. Same ownership shape as
-- register_player()/add_existing_player_to_team() -- team_manager or
-- organizer who owns one of the player's teams, platform_admin, or
-- (forward-compatible, no claim flow exists yet) the player themself
-- once players.profile_id is set.
-- ---------------------------------------------------------------------

create function set_player_photo(p_player_id uuid, p_photo_url text)
returns void as $$
declare
  v_caller_role user_role;
  v_is_self boolean;
  v_owns_a_team boolean;
begin
  select role into v_caller_role from profiles where id = auth.uid();

  select exists (
    select 1 from players where id = p_player_id and profile_id = auth.uid()
  ) into v_is_self;

  select exists (
    select 1 from team_players tp
    join teams t on t.id = tp.team_id
    where tp.player_id = p_player_id and t.team_manager_profile_id = auth.uid()
  ) into v_owns_a_team;

  if not (
    v_is_self
    or (v_caller_role in ('team_manager', 'organizer') and v_owns_a_team)
    or v_caller_role = 'platform_admin'
  ) then
    raise exception 'not permitted to set this player''s photo';
  end if;

  update players set photo_url = p_photo_url where id = p_player_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'player_photo_updated', 'players', p_player_id, jsonb_build_object('photo_url', p_photo_url));
end;
$$ language plpgsql security definer;

revoke execute on function set_player_photo(uuid, text) from public;
grant execute on function set_player_photo(uuid, text) to authenticated;
