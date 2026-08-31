import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import LineupForm from "./lineup-form";
import RecordEventForm from "./record-event-form";
import { StartMatchButton, FinishMatchButton } from "./match-controls";

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
      "id, status, scheduled_at, assigned_operator_profile_id, home_team_id, away_team_id, home:teams!home_team_id(id, name), away:teams!away_team_id(id, name)"
    )
    .eq("id", matchId)
    .single();

  type MatchDetail = {
    id: string;
    status: string;
    scheduled_at: string | null;
    assigned_operator_profile_id: string | null;
    home_team_id: string;
    away_team_id: string;
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
    .select("id, event_type, minute, source, created_at, players(full_name, alias)")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });

  type EventRow = {
    id: string;
    event_type: string;
    minute: number | null;
    source: string;
    created_at: string;
    players: { full_name: string; alias: string | null } | null;
  };
  const events = (eventRows ?? []) as unknown as EventRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">
        {matchDetail.home?.name} vs {matchDetail.away?.name}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {matchDetail.scheduled_at
          ? new Date(matchDetail.scheduled_at).toLocaleString()
          : "TBD"}{" "}
        · Status: {matchDetail.status}
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

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Recorded events ({events.length})
        </h2>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium">
                  {e.event_type.replace("_", " ")} · {e.players?.full_name}
                  {e.players?.alias ? ` (${e.players.alias})` : ""}
                  {e.minute !== null ? ` (${e.minute}')` : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  via {e.source === "whatsapp_bot" ? "WhatsApp" : "Match Center"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
