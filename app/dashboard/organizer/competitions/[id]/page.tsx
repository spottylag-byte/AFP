import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AddTeamForm from "./add-team-form";
import CreateTeamForm from "./create-team-form";
import CreateFixtureForm from "./create-fixture-form";
import AssignOperatorForm from "./assign-operator-form";
import VerifyPublishButton from "./verify-publish-button";
import FlagDisputeButton from "./flag-dispute-button";
import CorrectionsQueue, { type PendingCorrection } from "./corrections-queue";

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: competitionId } = await params;
  const { user } = await requireRole("organizer");
  const supabase = await createClient();

  const { data: organizer } = await supabase
    .from("organizers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, season, status, organizer_id")
    .eq("id", competitionId)
    .is("deleted_at", null)
    .single();

  if (!competition || !organizer || competition.organizer_id !== organizer.id) {
    notFound();
  }

  const { data: enteredTeamRows } = await supabase
    .from("competition_teams")
    .select("team_id, teams(id, name, team_manager_profile_id)")
    .eq("competition_id", competitionId);

  type EnteredTeamRow = {
    team_id: string;
    teams: { id: string; name: string; team_manager_profile_id: string } | null;
  };
  const enteredTeams = ((enteredTeamRows ?? []) as unknown as EnteredTeamRow[])
    .map((r) => r.teams)
    .filter(
      (t): t is { id: string; name: string; team_manager_profile_id: string } => t !== null
    );

  const { data: allTeams } = await supabase
    .from("teams")
    .select("id, name")
    .is("deleted_at", null);

  const enteredTeamIds = new Set(enteredTeams.map((t) => t.id));
  const availableTeams = (allTeams ?? []).filter((t) => !enteredTeamIds.has(t.id));

  const { data: fixtureRows } = await supabase
    .from("matches")
    .select(
      "id, scheduled_at, status, assigned_operator_profile_id, home_score, away_score, home:teams!home_team_id(name), away:teams!away_team_id(name), operator:profiles!assigned_operator_profile_id(full_name)"
    )
    .eq("competition_id", competitionId)
    .is("deleted_at", null)
    .order("scheduled_at", { ascending: true });

  type FixtureRow = {
    id: string;
    scheduled_at: string | null;
    status: string;
    assigned_operator_profile_id: string | null;
    home_score: number | null;
    away_score: number | null;
    home: { name: string } | null;
    away: { name: string } | null;
    operator: { full_name: string } | null;
  };
  const fixtures = (fixtureRows ?? []) as unknown as FixtureRow[];

  const { data: operators } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "match_operator");

  const fixtureIds = fixtures.map((f) => f.id);

  const { data: eventRows } = await supabase
    .from("match_events")
    .select("id, match_id, event_type, minute, compensates_event_id, players(full_name)")
    .in("match_id", fixtureIds.length > 0 ? fixtureIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });

  type EventRow = {
    id: string;
    match_id: string;
    event_type: string;
    minute: number | null;
    compensates_event_id: string | null;
    players: { full_name: string } | null;
  };
  const eventsByMatch = new Map<string, EventRow[]>();
  for (const e of (eventRows ?? []) as unknown as EventRow[]) {
    const list = eventsByMatch.get(e.match_id) ?? [];
    list.push(e);
    eventsByMatch.set(e.match_id, list);
  }

  const { data: pendingRows } = await supabase
    .from("correction_requests")
    .select(
      "id, reason, evidence_url, requester:profiles!requested_by(full_name), match_events(event_type, minute, match_id, players(full_name))"
    )
    .eq("status", "pending");

  type PendingRow = {
    id: string;
    reason: string;
    evidence_url: string | null;
    requester: { full_name: string } | null;
    match_events: {
      event_type: string;
      minute: number | null;
      match_id: string;
      players: { full_name: string } | null;
    } | null;
  };
  const fixtureIdSet = new Set(fixtureIds);
  const pendingForThisCompetition = ((pendingRows ?? []) as unknown as PendingRow[]).filter(
    (p) => p.match_events && fixtureIdSet.has(p.match_events.match_id)
  );

  const relevantMatchIds = Array.from(
    new Set(pendingForThisCompetition.map((p) => p.match_events!.match_id))
  );

  const { data: lineupRows } = await supabase
    .from("match_lineups")
    .select("match_id, player_id, players(full_name)")
    .in("match_id", relevantMatchIds.length > 0 ? relevantMatchIds : ["00000000-0000-0000-0000-000000000000"]);

  type LineupRow = { match_id: string; player_id: string; players: { full_name: string } | null };
  const lineupsByMatch = new Map<string, { id: string; full_name: string }[]>();
  for (const l of (lineupRows ?? []) as unknown as LineupRow[]) {
    if (!l.players) continue;
    const list = lineupsByMatch.get(l.match_id) ?? [];
    list.push({ id: l.player_id, full_name: l.players.full_name });
    lineupsByMatch.set(l.match_id, list);
  }

  const pendingCorrections: PendingCorrection[] = pendingForThisCompetition.map((p) => ({
    id: p.id,
    reason: p.reason,
    evidence_url: p.evidence_url,
    requested_by_name: p.requester?.full_name ?? "Unknown",
    original_event_type: p.match_events!.event_type,
    original_player_name: p.match_events!.players?.full_name ?? null,
    original_minute: p.match_events!.minute,
    lineup_players: lineupsByMatch.get(p.match_events!.match_id) ?? [],
  }));

  const { data: standingsRows } = await supabase
    .from("team_statistics")
    .select("played, won, drawn, lost, goals_for, goals_against, points, teams(name)")
    .eq("competition_id", competitionId)
    .order("points", { ascending: false });

  type StandingsRow = {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    points: number;
    teams: { name: string } | null;
  };
  const standings = (standingsRows ?? []) as unknown as StandingsRow[];

  const { data: scorerRows } = await supabase
    .from("player_competition_stats")
    .select("goals, appearances, players(full_name, alias)")
    .eq("competition_id", competitionId)
    .gt("goals", 0)
    .order("goals", { ascending: false });

  type ScorerRow = {
    goals: number;
    appearances: number;
    players: { full_name: string; alias: string | null } | null;
  };
  const scorers = (scorerRows ?? []) as unknown as ScorerRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {competition.name}
        {competition.season ? ` (${competition.season})` : ""}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Status: {competition.status}
      </p>
      {competition.status === "published" && (
        <p className="mt-1 text-sm">
          <a
            href={`/competitions/${competitionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View public page
          </a>
        </p>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Add an existing team</h2>
        <div className="mt-2">
          <AddTeamForm competitionId={competitionId} availableTeams={availableTeams} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-zinc-500">
          Onboard a new team
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          For a team that&apos;s new to the platform. You&apos;ll become its manager-of-record
          and can build its roster from the roster page afterwards.
        </p>
        <div className="mt-2">
          <CreateTeamForm competitionId={competitionId} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-zinc-500">
          Teams in this competition ({enteredTeams.length})
        </h2>
        {enteredTeams.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">None yet.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {enteredTeams.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800"
              >
                {t.name}
                {t.team_manager_profile_id === user.id && (
                  <Link
                    href={`/dashboard/organizer/teams/${t.id}`}
                    className="text-xs underline text-zinc-500"
                  >
                    Manage roster
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Schedule a fixture</h2>
        <div className="mt-2">
          <CreateFixtureForm competitionId={competitionId} enteredTeams={enteredTeams} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Fixtures ({fixtures.length})
        </h2>
        {fixtures.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No fixtures yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {fixtures.map((f) => (
              <li
                key={f.id}
                className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium">
                  {f.home?.name}
                  {f.home_score !== null && f.away_score !== null
                    ? ` ${f.home_score} - ${f.away_score} `
                    : " vs "}
                  {f.away?.name}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {f.scheduled_at ? new Date(f.scheduled_at).toLocaleString() : "TBD"} ·
                  Status: {f.status}
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {f.operator ? (
                    <p className="text-xs text-zinc-500">
                      Operator: {f.operator.full_name}
                    </p>
                  ) : (
                    <AssignOperatorForm
                      competitionId={competitionId}
                      matchId={f.id}
                      operators={operators ?? []}
                    />
                  )}
                  {f.status === "finished" && (
                    <VerifyPublishButton competitionId={competitionId} matchId={f.id} />
                  )}
                </div>
                {["finished", "verified", "published"].includes(f.status) && (
                  <div className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-500">Events</p>
                    {(eventsByMatch.get(f.id) ?? []).length === 0 ? (
                      <p className="text-xs text-zinc-500">None recorded.</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-1">
                        {(eventsByMatch.get(f.id) ?? []).map((e) => (
                          <li key={e.id} className="text-xs">
                            {e.event_type.replace("_", " ")}
                            {e.players ? ` · ${e.players.full_name}` : ""}
                            {e.minute !== null ? ` (${e.minute}')` : ""}
                            {e.compensates_event_id && (
                              <span className="text-zinc-400"> (correction)</span>
                            )}
                            <span className="ml-2">
                              <FlagDisputeButton competitionId={competitionId} eventId={e.id} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Pending corrections ({pendingCorrections.length})
        </h2>
        <div className="mt-2">
          <CorrectionsQueue competitionId={competitionId} corrections={pendingCorrections} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Standings</h2>
        {standings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No published matches yet.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="pr-4 font-medium">Team</th>
                  <th className="pr-4 font-medium">P</th>
                  <th className="pr-4 font-medium">W</th>
                  <th className="pr-4 font-medium">D</th>
                  <th className="pr-4 font-medium">L</th>
                  <th className="pr-4 font-medium">GF</th>
                  <th className="pr-4 font-medium">GA</th>
                  <th className="font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={i} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-1 pr-4">{s.teams?.name}</td>
                    <td className="pr-4">{s.played}</td>
                    <td className="pr-4">{s.won}</td>
                    <td className="pr-4">{s.drawn}</td>
                    <td className="pr-4">{s.lost}</td>
                    <td className="pr-4">{s.goals_for}</td>
                    <td className="pr-4">{s.goals_against}</td>
                    <td className="font-medium">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Top scorers</h2>
        {scorers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No goals yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {scorers.map((s, i) => (
              <li key={i}>
                {s.players?.full_name}
                {s.players?.alias ? ` (${s.players.alias})` : ""} — {s.goals} goal
                {s.goals === 1 ? "" : "s"} (
                {s.appearances} app{s.appearances === 1 ? "" : "s"})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
