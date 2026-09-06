-- Player videos: highlight clips a player can point a scout at,
-- alongside their verified stats. Same shape as player photos
-- (0015) -- a public bucket for the raw file, a funnel function that
-- gates which player record a clip gets attached to. Multiple clips
-- per player, so a table rather than a single column.

create table player_videos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id),
  video_url text not null,
  caption text,
  uploaded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table player_videos enable row level security;

create policy "Anyone authenticated can view player videos"
  on player_videos for select
  to authenticated
  using (true);

create policy "Public can view player videos"
  on player_videos for select
  to public
  using (true);

insert into storage.buckets (id, name, public, file_size_limit)
values ('player-videos', 'player-videos', true, 52428800) -- 50MB
on conflict (id) do nothing;

create policy "Anyone authenticated can upload player videos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'player-videos');

create policy "Anyone can view player video files"
  on storage.objects for select
  to public
  using (bucket_id = 'player-videos');

create policy "Uploader can delete their own player video file"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'player-videos' and owner = auth.uid());

-- addPlayerVideo(): same ownership gate as set_player_photo() --
-- team_manager/organizer who owns one of the player's teams,
-- platform_admin, or (forward-compatible) the player themself.
create function add_player_video(p_player_id uuid, p_video_url text, p_caption text default null)
returns uuid as $$
declare
  v_caller_role user_role;
  v_is_self boolean;
  v_owns_a_team boolean;
  v_new_id uuid;
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
    raise exception 'not permitted to add a video for this player';
  end if;

  insert into player_videos (player_id, video_url, caption, uploaded_by)
  values (p_player_id, p_video_url, p_caption, auth.uid())
  returning id into v_new_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'player_video_added', 'players', p_player_id, jsonb_build_object('video_id', v_new_id, 'video_url', p_video_url));

  return v_new_id;
end;
$$ language plpgsql security definer;

revoke execute on function add_player_video(uuid, text, text) from public;
grant execute on function add_player_video(uuid, text, text) to authenticated;

-- removePlayerVideo(): same gate, checked against the video's own
-- player_id rather than trusting the caller to pass a consistent pair.
create function remove_player_video(p_video_id uuid)
returns void as $$
declare
  v_caller_role user_role;
  v_player_id uuid;
  v_is_self boolean;
  v_owns_a_team boolean;
begin
  select player_id into v_player_id from player_videos where id = p_video_id;
  if v_player_id is null then
    raise exception 'video not found';
  end if;

  select role into v_caller_role from profiles where id = auth.uid();

  select exists (
    select 1 from players where id = v_player_id and profile_id = auth.uid()
  ) into v_is_self;

  select exists (
    select 1 from team_players tp
    join teams t on t.id = tp.team_id
    where tp.player_id = v_player_id and t.team_manager_profile_id = auth.uid()
  ) into v_owns_a_team;

  if not (
    v_is_self
    or (v_caller_role in ('team_manager', 'organizer') and v_owns_a_team)
    or v_caller_role = 'platform_admin'
  ) then
    raise exception 'not permitted to remove this video';
  end if;

  delete from player_videos where id = p_video_id;

  insert into audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'player_video_removed', 'players', v_player_id, jsonb_build_object('video_id', p_video_id));
end;
$$ language plpgsql security definer;

revoke execute on function remove_player_video(uuid) from public;
grant execute on function remove_player_video(uuid) to authenticated;
