import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AddTeamForm from "./add-team-form";
import CreateFixtureForm from "./create-fixture-form";
import AssignOperatorForm from "./assign-operator-form";
import VerifyPublishButton from "./verify-publish-button";

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
    .single();

  if (!competition || !organizer || competition.organizer_id !== organizer.id) {
    notFound();
  }

  const { data: enteredTeamRows } = await supabase
    .from("competition_teams")
    .select("team_id, teams(id, name)")
    .eq("competition_id", competitionId);

  type EnteredTeamRow = { team_id: string; teams: { id: string; name: string } | null };
  const enteredTeams = ((enteredTeamRows ?? []) as unknown as EnteredTeamRow[])
    .map((r) => r.teams)
    .filter((t): t is { id: string; name: string } => t !== null);

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
    .select("goals, appearances, players(full_name)")
    .eq("competition_id", competitionId)
    .gt("goals", 0)
    .order("goals", { ascending: false });

  type ScorerRow = { goals: number; appearances: number; players: { full_name: string } | null };
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

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Add a team</h2>
        <div className="mt-2">
          <AddTeamForm competitionId={competitionId} availableTeams={availableTeams} />
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
                className="rounded border border-zinc-200 px-3 py-1 text-sm dark:border-zinc-800"
              >
                {t.name}
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
              </li>
            ))}
          </ul>
        )}
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
                {s.players?.full_name} — {s.goals} goal{s.goals === 1 ? "" : "s"} (
                {s.appearances} app{s.appearances === 1 ? "" : "s"})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
