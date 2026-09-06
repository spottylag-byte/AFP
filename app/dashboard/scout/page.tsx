import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/badge";
import PlayerAvatar from "@/components/player-avatar";
import ShortlistButton from "./shortlist-button";

const POSITIONS = ["GK", "DEF", "MID", "FWD"] as const;

function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default async function ScoutDashboard({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    position?: string;
    minAge?: string;
    maxAge?: string;
    verified?: string;
    shortlist?: string;
  }>;
}) {
  const { user, fullName } = await requireRole("scout");
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("scout_status")
    .eq("id", user.id)
    .single();

  if (profile?.scout_status !== "approved") {
    return (
      <div>
        <h1 className="text-xl font-semibold">Discover</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Welcome, {fullName}.</p>
        <div className="mt-6 rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm">
          {profile?.scout_status === "rejected" ? (
            <p>
              Your scout account application was not approved. Contact the platform admin
              if you believe this is a mistake.
            </p>
          ) : (
            <p>
              Your scout account is pending admin approval. This exists to keep player
              contact information safe from people posing as scouts — you&apos;ll get
              access to Discover and shortlists once an admin approves your account.
            </p>
          )}
        </div>
      </div>
    );
  }

  let query = supabase
    .from("players")
    .select("id, full_name, alias, position, height_cm, preferred_foot, photo_url, date_of_birth")
    .is("deleted_at", null);

  if (sp.q) query = query.ilike("full_name", `%${sp.q}%`);
  if (sp.position) query = query.eq("position", sp.position);

  const { data: playerRows } = await query;

  type PlayerRow = {
    id: string;
    full_name: string;
    alias: string | null;
    position: string | null;
    height_cm: number | null;
    preferred_foot: string | null;
    photo_url: string | null;
    date_of_birth: string;
  };
  let players = (playerRows ?? []) as PlayerRow[];

  const minAge = sp.minAge ? Number(sp.minAge) : null;
  const maxAge = sp.maxAge ? Number(sp.maxAge) : null;
  if (minAge !== null) players = players.filter((p) => ageFromDob(p.date_of_birth) >= minAge);
  if (maxAge !== null) players = players.filter((p) => ageFromDob(p.date_of_birth) <= maxAge);

  const playerIds = players.map((p) => p.id);

  const [{ data: statRows }, { data: teamRows }, { data: shortlistRows }, { data: videoRows }] = await Promise.all([
    playerIds.length
      ? supabase
          .from("player_competition_stats")
          .select("player_id, goals, assists, appearances")
          .in("player_id", playerIds)
      : Promise.resolve({ data: [] as { player_id: string; goals: number; assists: number; appearances: number }[] }),
    playerIds.length
      ? supabase
          .from("team_players")
          .select("player_id, teams(name)")
          .in("player_id", playerIds)
          .is("left_at", null)
      : Promise.resolve({ data: [] as { player_id: string; teams: { name: string } | null }[] }),
    supabase
      .from("shortlist_players")
      .select("player_id, shortlists!inner(scout_profile_id)")
      .eq("shortlists.scout_profile_id", user.id),
    playerIds.length
      ? supabase.from("player_videos").select("player_id").in("player_id", playerIds)
      : Promise.resolve({ data: [] as { player_id: string }[] }),
  ]);

  const videoCountByPlayer = new Map<string, number>();
  for (const row of videoRows ?? []) {
    videoCountByPlayer.set(row.player_id, (videoCountByPlayer.get(row.player_id) ?? 0) + 1);
  }

  const statsByPlayer = new Map<string, { goals: number; assists: number; appearances: number }>();
  for (const row of statRows ?? []) {
    const existing = statsByPlayer.get(row.player_id) ?? { goals: 0, assists: 0, appearances: 0 };
    existing.goals += row.goals;
    existing.assists += row.assists;
    existing.appearances += row.appearances;
    statsByPlayer.set(row.player_id, existing);
  }

  const teamByPlayer = new Map<string, string>();
  for (const row of (teamRows ?? []) as unknown as { player_id: string; teams: { name: string } | null }[]) {
    if (row.teams && !teamByPlayer.has(row.player_id)) {
      teamByPlayer.set(row.player_id, row.teams.name);
    }
  }

  const shortlistedIds = new Set((shortlistRows ?? []).map((r) => r.player_id as string));

  let results = players.map((p) => ({
    ...p,
    age: ageFromDob(p.date_of_birth),
    goals: statsByPlayer.get(p.id)?.goals ?? 0,
    assists: statsByPlayer.get(p.id)?.assists ?? 0,
    appearances: statsByPlayer.get(p.id)?.appearances ?? 0,
    team: teamByPlayer.get(p.id) ?? null,
    shortlisted: shortlistedIds.has(p.id),
    videoCount: videoCountByPlayer.get(p.id) ?? 0,
  }));

  if (sp.verified === "1") {
    results = results.filter((r) => r.appearances > 0);
  }
  if (sp.shortlist === "1") {
    results = results.filter((r) => r.shortlisted);
  }

  results.sort((a, b) => b.goals - a.goals);

  const POSITION_LABELS: Record<string, string> = {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    FWD: "Forward",
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">Discover</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Welcome, {fullName}.</p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <form className="flex flex-col gap-5 text-sm" method="get">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-500">Filters</h2>
            <Link href="/dashboard/scout" className="text-xs underline text-zinc-500">
              Reset
            </Link>
          </div>

          <label className="flex flex-col gap-1">
            Search
            <input
              type="text"
              name="q"
              defaultValue={sp.q}
              placeholder="Player name"
              className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span>Position</span>
            <div className="flex flex-wrap gap-1">
              {POSITIONS.map((pos) => (
                <label
                  key={pos}
                  className={`cursor-pointer rounded border px-2.5 py-1 text-xs ${
                    sp.position === pos
                      ? "border-primary bg-primary/10 font-medium text-primary-hover"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="position"
                    value={pos}
                    defaultChecked={sp.position === pos}
                    className="hidden"
                  />
                  {pos}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span>Age range</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="minAge"
                defaultValue={sp.minAge}
                placeholder="min"
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="text-zinc-500">to</span>
              <input
                type="number"
                name="maxAge"
                defaultValue={sp.maxAge}
                placeholder="max"
                className="w-16 rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <label className="flex items-center justify-between">
            <span>Has verified match stats</span>
            <input
              type="checkbox"
              name="verified"
              value="1"
              defaultChecked={sp.verified === "1"}
            />
          </label>

          <label className="flex items-center justify-between">
            <span>Shortlist only</span>
            <input
              type="checkbox"
              name="shortlist"
              value="1"
              defaultChecked={sp.shortlist === "1"}
            />
          </label>

          <button
            type="submit"
            className="rounded bg-primary px-3 py-2 font-medium text-white hover:bg-primary-hover"
          >
            Search
          </button>
        </form>

        <div>
          <p className="text-sm text-zinc-500">
            {results.length} player{results.length === 1 ? "" : "s"} matching
          </p>

          {results.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              No players match these filters.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar fullName={r.full_name} photoUrl={r.photo_url} size={36} />
                      <Link href={`/players/${r.id}`} className="font-medium underline">
                        {r.full_name}
                        {r.alias ? ` (${r.alias})` : ""}
                      </Link>
                    </div>
                    <ShortlistButton playerId={r.id} shortlisted={r.shortlisted} />
                  </div>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {r.position ? POSITION_LABELS[r.position] : "Position unknown"} · Age{" "}
                    {r.age}
                    {r.preferred_foot ? ` · ${r.preferred_foot} foot` : ""}
                    {r.height_cm ? ` · ${r.height_cm}cm` : ""}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {r.team ?? "No current team"}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span>
                      <strong>{r.goals}</strong> goals
                    </span>
                    <span>
                      <strong>{r.assists}</strong> assists
                    </span>
                    <span>
                      <strong>{r.appearances}</strong> apps
                    </span>
                    {r.appearances > 0 ? (
                      <Badge kind="verified">Verified</Badge>
                    ) : (
                      <Badge kind="unverified">No match record</Badge>
                    )}
                    {r.videoCount > 0 && (
                      <Link href={`/players/${r.id}`} className="text-xs text-zinc-500 underline">
                        🎥 {r.videoCount}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
