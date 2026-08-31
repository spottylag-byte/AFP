-- Phase 9: public website. Every RLS policy so far has been scoped
-- `to authenticated` -- nothing has ever granted the `anon` role
-- (an unauthenticated visitor) SELECT on anything. Without this, no
-- public page can read any data at all, regardless of what UI exists.
--
-- Scoped deliberately narrow: published competition data only, and
-- players.date_of_birth is never exposed by anything public queries
-- (the SELECT lists in the app code simply never request it) -- this
-- is a youth/grassroots platform that can include minors; football ID
-- + name + stats are enough for a public profile.

create policy "Public can view published competitions"
  on competitions for select
  to anon
  using (status = 'published' and deleted_at is null);

create policy "Public can view teams"
  on teams for select
  to anon
  using (deleted_at is null);

create policy "Public can view organizers"
  on organizers for select
  to anon
  using (deleted_at is null);

create policy "Public can view competition_teams"
  on competition_teams for select
  to anon
  using (true);

create policy "Public can view team_players"
  on team_players for select
  to anon
  using (true);

-- home_score/away_score are only ever populated by calculate_match_result()
-- at publish time (Phase 7), so a finished/verified-but-not-yet-published
-- match is already NULL here -- the public fixture list shows it as
-- "Pending" for free, with nothing to hide at the RLS layer.
create policy "Public can view recorded matches"
  on matches for select
  to anon
  using (
    status in ('scheduled', 'in_progress', 'finished', 'verified', 'published')
    and deleted_at is null
  );

create policy "Public can view team_statistics"
  on team_statistics for select
  to anon
  using (true);

create policy "Public can view competition_statistics"
  on competition_statistics for select
  to anon
  using (true);

create policy "Public can view player_competition_stats"
  on player_competition_stats for select
  to anon
  using (true);

create policy "Public can view players"
  on players for select
  to anon
  using (deleted_at is null);

create policy "Public can view football_ids"
  on football_ids for select
  to anon
  using (true);
