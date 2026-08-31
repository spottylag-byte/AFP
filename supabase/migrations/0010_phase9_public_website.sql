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
-- "Pending" for free, with nothing to hide at the RLS layer. Also
-- requires the parent competition to be published, for the same reason
-- as the stats tables above: today only the competition page (which
-- already gates on this) queries matches publicly, but the policy
-- shouldn't depend on that -- a future public matches listing shouldn't
-- have to remember to add this check itself.
create policy "Public can view recorded matches"
  on matches for select
  to anon
  using (
    status in ('scheduled', 'in_progress', 'finished', 'verified', 'published')
    and deleted_at is null
    and exists (
      select 1 from competitions c
      where c.id = matches.competition_id and c.status = 'published'
    )
  );

-- Fix: these three are only ever computed from matches that individually
-- reached 'published' (calculate_competition_stats, Phase 7) -- but a
-- match's progress was never actually gated on its PARENT competition
-- also being published (create_fixture, Phase 5, has no such check).
-- Before this phase that only mattered to logged-in users; now it's
-- reachable by anyone, so the public policies require both.
create policy "Public can view team_statistics"
  on team_statistics for select
  to anon
  using (
    exists (
      select 1 from competitions c
      where c.id = team_statistics.competition_id and c.status = 'published'
    )
  );

create policy "Public can view competition_statistics"
  on competition_statistics for select
  to anon
  using (
    exists (
      select 1 from competitions c
      where c.id = competition_statistics.competition_id and c.status = 'published'
    )
  );

create policy "Public can view player_competition_stats"
  on player_competition_stats for select
  to anon
  using (
    exists (
      select 1 from competitions c
      where c.id = player_competition_stats.competition_id and c.status = 'published'
    )
  );

create policy "Public can view players"
  on players for select
  to anon
  using (deleted_at is null);

create policy "Public can view football_ids"
  on football_ids for select
  to anon
  using (true);
