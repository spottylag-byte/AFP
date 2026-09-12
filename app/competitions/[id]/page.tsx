import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsAppShareLink from "@/components/whatsapp-share-link";
import Badge from "@/components/badge";
import PlayerAvatar from "@/components/player-avatar";

export default async function PublicCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: competitionId } = await params;
  const supabase = await createClient();

  const { data: competition } = await supabase
    .from("competitions")
    .select("id, name, season, status, organizers(organization_name)")
    .eq("id", competitionId)
    .single();

  type Competition = {
    id: string;
    name: string;
    season: string | null;
    status: string;
    organizers: { organization_name: string } | null;
  };
  const comp = competition as unknown as Competition | null;

  if (!comp) {
    notFound();
  }

  const { data: teamRows } = await supabase
    .from("competition_teams")
    .select("teams(id, name)")
    .eq("competition_id", competitionId);

  type TeamRow = { teams: { id: string; name: string } | null };
  const teams = ((teamRows ?? []) as unknown as TeamRow[])
    .map((r) => r.teams)
    .filter((t): t is { id: string; name: string } => t !== null);

  const { data: fixtureRows } = await supabase
    .from("matches")
    .select(
      "id, scheduled_at, status, home_score, away_score, home:teams!home_team_id(name), away:teams!away_team_id(name)"
    )
    .eq("competition_id", competitionId)
    .order("scheduled_at", { ascending: true });

  type FixtureRow = {
    id: string;
    scheduled_at: string | null;
    status: string;
    home_score: number | null;
    away_score: number | null;
    home: { name: string } | null;
    away: { name: string } | null;
  };
  const fixtures = (fixtureRows ?? []) as unknown as FixtureRow[];

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
    .select("goals, assists, player_id, players(full_name, alias, photo_url)")
    .eq("competition_id", competitionId)
    .gt("goals", 0)
    .order("goals", { ascending: false });

  type ScorerRow = {
    goals: number;
    assists: number;
    player_id: string;
    players: { full_name: string; alias: string | null; photo_url: string | null } | null;
  };
  const scorers = (scorerRows ?? []) as unknown as ScorerRow[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          African Football Platform
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {comp.name}
        {comp.season ? ` (${comp.season})` : ""}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {comp.organizers?.organization_name}
      </p>
      <div className="mt-3">
        <WhatsAppShareLink
          path={`/competitions/${competitionId}`}
          text={`Check out ${comp.name}:`}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Teams</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {teams.map((t) => (
            <li key={t.id}>
              <Link
                href={`/teams/${t.id}`}
                className="rounded border border-zinc-200 px-3 py-1 text-sm underline dark:border-zinc-800"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Standings</h2>
        {standings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No results yet.
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
        <h2 className="text-sm font-medium text-zinc-500">Fixtures & results</h2>
        {fixtures.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No fixtures yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {fixtures.map((f) => (
              <li
                key={f.id}
                className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium">
                  {f.home?.name}
                  {f.status === "published" && f.home_score !== null && f.away_score !== null
                    ? ` ${f.home_score} - ${f.away_score} `
                    : " vs "}
                  {f.away?.name}
                </p>
                <p className="mt-1 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  {f.scheduled_at ? new Date(f.scheduled_at).toLocaleString() : "TBD"}
                  {f.status === "published" ? (
                    <Badge kind="verified">Verified</Badge>
                  ) : f.status === "finished" || f.status === "verified" ? (
                    <Badge kind="pending">Pending verification</Badge>
                  ) : (
                    <Badge kind="unverified">Upcoming</Badge>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Top scorers</h2>
        {scorers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No goals yet.</p>
        ) : (
          <ol className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {scorers.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <span className="w-5 shrink-0 text-right text-zinc-400">{i + 1}.</span>
                <PlayerAvatar
                  fullName={s.players?.full_name ?? ""}
                  photoUrl={s.players?.photo_url ?? null}
                  size={36}
                />
                <div className="min-w-0">
                  <Link href={`/players/${s.player_id}`} className="font-medium underline">
                    {s.players?.full_name}
                    {s.players?.alias ? ` (${s.players.alias})` : ""}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {s.goals} goal{s.goals === 1 ? "" : "s"}
                    {s.assists > 0 ? `, ${s.assists} assist${s.assists === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
