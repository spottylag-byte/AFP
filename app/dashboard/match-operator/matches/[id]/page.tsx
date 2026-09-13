import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import LineupForm from "./lineup-form";
import RecordEventForm from "./record-event-form";
import { StartMatchButton, FinishMatchButton } from "./match-controls";
import Badge from "@/components/badge";

export default async function MatchCenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: matchId } = await params;
  const { user } = await requireRole("match_operator");
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select(
      "id, status, scheduled_at, assigned_operator_profile_id, home_team_id, away_team_id, home_score, away_score, home:teams!home_team_id(id, name), away:teams!away_team_id(id, name)"
    )
    .eq("id", matchId)
    .is("deleted_at", null)
    .single();

  type MatchDetail = {
    id: string;
    status: string;
    scheduled_at: string | null;
    assigned_operator_profile_id: string | null;
    home_team_id: string;
    away_team_id: string;
    home_score: number | null;
    away_score: number | null;
    home: { id: string; name: string } | null;
    away: { id: string; name: string } | null;
  };
  const matchDetail = match as unknown as MatchDetail | null;

  if (!matchDetail || matchDetail.assigned_operator_profile_id !== user.id) {
    notFound();
  }

  async function fetchRoster(teamId: string) {
    const { data } = await supabase
      .from("team_players")
      .select("player_id, players(id, full_name, alias)")
      .eq("team_id", teamId)
      .is("left_at", null);

    type Row = {
      player_id: string;
      players: { id: string; full_name: string; alias: string | null } | null;
    };
    return ((data ?? []) as unknown as Row[])
      .map((r) => r.players)
      .filter((p): p is { id: string; full_name: string; alias: string | null } => p !== null);
  }

  const [homeRoster, awayRoster] = await Promise.all([
    fetchRoster(matchDetail.home_team_id),
    fetchRoster(matchDetail.away_team_id),
  ]);

  const { data: lineupRows } = await supabase
    .from("match_lineups")
    .select("player_id, team_id, players(full_name, alias)")
    .eq("match_id", matchId);

  type LineupRow = {
    player_id: string;
    team_id: string;
    players: { full_name: string; alias: string | null } | null;
  };
  const lineups = (lineupRows ?? []) as unknown as LineupRow[];

  const homeLineupIds = lineups
    .filter((l) => l.team_id === matchDetail.home_team_id)
    .map((l) => l.player_id);
  const awayLineupIds = lineups
    .filter((l) => l.team_id === matchDetail.away_team_id)
    .map((l) => l.player_id);

  const lineupPlayers = lineups
    .filter((l) => l.players !== null)
    .map((l) => ({
      id: l.player_id,
      full_name: l.players!.full_name,
      alias: l.players!.alias,
      teamName:
        l.team_id === matchDetail.home_team_id
          ? matchDetail.home?.name ?? "Home"
          : matchDetail.away?.name ?? "Away",
    }));

  const { data: eventRows } = await supabase
    .from("match_events")
    .select("id, event_type, minute, source, team_id, created_at, players(full_name, alias)")
    .eq("match_id", matchId)
    .is("compensates_event_id", null)
    .order("minute", { ascending: true, nullsFirst: false });

  type EventRow = {
    id: string;
    event_type: string;
    minute: number | null;
    source: string;
    team_id: string | null;
    created_at: string;
    players: { full_name: string; alias: string | null } | null;
  };
  const events = (eventRows ?? []) as unknown as EventRow[];

  const homeTeamId = matchDetail.home_team_id;
  const awayTeamId = matchDetail.away_team_id;
  const homeName = matchDetail.home?.name ?? "Home";
  const awayName = matchDetail.away?.name ?? "Away";

  function playerLabel(e: EventRow) {
    return `${e.players?.full_name ?? "Unknown"}${e.players?.alias ? ` "${e.players.alias}"` : ""}${
      e.minute !== null ? ` ${e.minute}'` : ""
    }`;
  }

  // A goal scored FOR a team is either their own 'goal' events or the
  // opponent's 'own_goal' events -- same attribution calculate_match_result()
  // uses when it derives home_score/away_score.
  const goalsFor = (teamId: string, opponentId: string) =>
    events.filter(
      (e) =>
        (e.event_type === "goal" && e.team_id === teamId) ||
        (e.event_type === "own_goal" && e.team_id === opponentId)
    );
  const assistsFor = (teamId: string) => events.filter((e) => e.event_type === "assist" && e.team_id === teamId);
  const cardsFor = (teamId: string) =>
    events.filter((e) => (e.event_type === "yellow_card" || e.event_type === "red_card") && e.team_id === teamId);

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {matchDetail.home?.name} vs {matchDetail.away?.name}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {matchDetail.scheduled_at
          ? new Date(matchDetail.scheduled_at).toLocaleString()
          : "TBD"}
        {matchDetail.status === "finished" ? (
          <Badge kind="verified">Finished</Badge>
        ) : matchDetail.status === "in_progress" ? (
          <Badge kind="pending">Live</Badge>
        ) : (
          <Badge kind="unverified">Scheduled</Badge>
        )}
      </p>

      {matchDetail.status === "scheduled" && (
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <LineupForm
            matchId={matchId}
            teamId={matchDetail.home_team_id}
            teamName={matchDetail.home?.name ?? "Home"}
            roster={homeRoster}
            initiallySelected={homeLineupIds}
          />
          <LineupForm
            matchId={matchId}
            teamId={matchDetail.away_team_id}
            teamName={matchDetail.away?.name ?? "Away"}
            roster={awayRoster}
            initiallySelected={awayLineupIds}
          />
          <div>
            <StartMatchButton matchId={matchId} />
          </div>
        </div>
      )}

      {matchDetail.status === "in_progress" && (
        <div className="mt-8 flex flex-col gap-6">
          <RecordEventForm matchId={matchId} lineupPlayers={lineupPlayers} />
          <FinishMatchButton matchId={matchId} />
        </div>
      )}

      {matchDetail.status === "finished" && (
        <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          This match is finished. Recording is closed.
        </p>
      )}

      <div className="mt-8 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
          <span className="font-medium">{homeName}</span>
          <span className="text-2xl font-bold">
            {matchDetail.home_score ?? "–"} : {matchDetail.away_score ?? "–"}
          </span>
          <span className="font-medium">{awayName}</span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
          {[
            { teamId: homeTeamId, opponentId: awayTeamId },
            { teamId: awayTeamId, opponentId: homeTeamId },
          ].map(({ teamId, opponentId }) => {
            const goals = goalsFor(teamId, opponentId);
            const assists = assistsFor(teamId);
            const cards = cardsFor(teamId);
            return (
              <div key={teamId} className="p-4 text-sm">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Goals ({goals.length})
                </h3>
                {goals.length === 0 ? (
                  <p className="mt-1 text-zinc-500">None</p>
                ) : (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {goals.map((e) => (
                      <li key={e.id}>
                        ⚽ {playerLabel(e)}
                        {e.event_type === "own_goal" ? " (OG)" : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {assists.length > 0 && (
                  <>
                    <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Assists ({assists.length})
                    </h3>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {assists.map((e) => (
                        <li key={e.id}>🎯 {playerLabel(e)}</li>
                      ))}
                    </ul>
                  </>
                )}

                {cards.length > 0 && (
                  <>
                    <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Cards ({cards.length})
                    </h3>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {cards.map((e) => (
                        <li key={e.id}>
                          {e.event_type === "red_card" ? "🟥" : "🟨"} {playerLabel(e)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
