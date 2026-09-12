import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsAppShareLink from "@/components/whatsapp-share-link";
import PlayerAvatar from "@/components/player-avatar";
import Badge from "@/components/badge";

const POSITION_LABELS: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export default async function PublicPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: playerId } = await params;
  const supabase = await createClient();

  // Deliberately does not select date_of_birth -- never shown publicly.
  const { data: player } = await supabase
    .from("players")
    .select(
      "id, full_name, alias, photo_url, photo_confirmed_by_player, position, height_cm, preferred_foot, country, city, football_ids(code)"
    )
    .eq("id", playerId)
    .is("deleted_at", null)
    .single();

  type Player = {
    id: string;
    full_name: string;
    alias: string | null;
    photo_url: string | null;
    photo_confirmed_by_player: boolean;
    position: string | null;
    height_cm: number | null;
    preferred_foot: string | null;
    country: string | null;
    city: string | null;
    football_ids: { code: string } | null;
  };
  const p = player as unknown as Player | null;

  if (!p) {
    notFound();
  }

  const { data: teamRow } = await supabase
    .from("team_players")
    .select("teams(id, name)")
    .eq("player_id", playerId)
    .is("left_at", null)
    .limit(1)
    .maybeSingle();
  const currentTeam = (teamRow as unknown as { teams: { id: string; name: string } | null })
    ?.teams;

  const { data: statRows } = await supabase
    .from("player_competition_stats")
    .select("goals, assists, appearances, yellow_cards, red_cards, competitions(id, name, season)")
    .eq("player_id", playerId);

  type StatRow = {
    goals: number;
    assists: number;
    appearances: number;
    yellow_cards: number;
    red_cards: number;
    competitions: { id: string; name: string; season: string | null } | null;
  };
  const stats = (statRows ?? []) as unknown as StatRow[];

  const { data: videoRows } = await supabase
    .from("player_videos")
    .select("id, video_url, caption, confirmed_by_player")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });
  const videos = (videoRows ?? []) as {
    id: string;
    video_url: string;
    caption: string | null;
    confirmed_by_player: boolean;
  }[];

  const career = stats.reduce(
    (acc, s) => ({
      goals: acc.goals + s.goals,
      assists: acc.assists + s.assists,
      appearances: acc.appearances + s.appearances,
      yellow_cards: acc.yellow_cards + s.yellow_cards,
      red_cards: acc.red_cards + s.red_cards,
    }),
    { goals: 0, assists: 0, appearances: 0, yellow_cards: 0, red_cards: 0 }
  );

  const bioRows = [
    { label: "Position", value: p.position ? POSITION_LABELS[p.position] : null },
    { label: "Preferred foot", value: p.preferred_foot ? capitalize(p.preferred_foot) : null },
    { label: "Height", value: p.height_cm ? `${p.height_cm} cm` : null },
    {
      label: "Based in",
      value: [p.city, p.country].filter(Boolean).join(", ") || null,
    },
    { label: "Current team", value: currentTeam?.name ?? null },
    { label: "Football ID", value: p.football_ids?.code ?? null },
  ].filter((r) => r.value);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          Soccer Point
        </Link>
      </p>

      {/* header band */}
      <div className="mt-4 flex flex-col gap-6 rounded-lg border border-ink/10 bg-ink p-6 text-chalk sm:flex-row sm:items-center">
        <PlayerAvatar fullName={p.full_name} photoUrl={p.photo_url} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">
            {p.full_name}
            {p.alias ? <span className="text-[#B9C3D4]"> &quot;{p.alias}&quot;</span> : ""}
          </h1>
          <p className="mt-1 text-sm text-[#B9C3D4]">
            {p.position ? POSITION_LABELS[p.position] : "Position unknown"}
            {currentTeam ? (
              <>
                {" · "}
                <Link href={`/teams/${currentTeam.id}`} className="underline">
                  {currentTeam.name}
                </Link>
              </>
            ) : (
              " · No current team"
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {career.appearances > 0 ? (
              <Badge kind="verified">Verified</Badge>
            ) : (
              <Badge kind="unverified">Unverified</Badge>
            )}
            {p.photo_url && p.photo_confirmed_by_player && (
              <span className="text-xs text-accent">✓ Photo confirmed by player</span>
            )}
            <span className="font-mono text-xs text-[#B9C3D4]">{p.football_ids?.code}</span>
          </div>
          <div className="mt-3">
            <WhatsAppShareLink
              path={`/players/${playerId}`}
              text={`Check out ${p.full_name}:`}
            />
          </div>
        </div>
      </div>

      {/* bio facts */}
      {bioRows.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {bioRows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">{r.label}</dt>
              <dd className="font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* key stat tiles */}
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-5">
        {[
          { label: "Appearances", value: career.appearances },
          { label: "Goals", value: career.goals },
          { label: "Assists", value: career.assists },
          { label: "Yellow cards", value: career.yellow_cards },
          { label: "Red cards", value: career.red_cards },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-zinc-200 bg-white p-3 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <p className="text-2xl font-semibold text-primary-hover">{tile.value}</p>
            <p className="text-xs text-zinc-500">{tile.label}</p>
          </div>
        ))}
      </div>

      {videos.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-zinc-500">Videos</h2>
          <div className="mt-2 flex flex-wrap gap-3">
            {videos.map((v) => (
              <div key={v.id}>
                <video
                  src={v.video_url}
                  controls
                  className="h-40 w-64 rounded bg-black object-cover"
                />
                {v.caption && (
                  <p className="mt-1 max-w-64 text-xs text-zinc-500">{v.caption}</p>
                )}
                {v.confirmed_by_player && (
                  <p className="text-xs text-primary-hover">✓ Confirmed by player</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">By competition</h2>
        {stats.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No verified statistics yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {stats.map((s, i) => (
              <li
                key={i}
                className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <Link
                  href={`/competitions/${s.competitions?.id}`}
                  className="font-medium underline"
                >
                  {s.competitions?.name}
                  {s.competitions?.season ? ` (${s.competitions.season})` : ""}
                </Link>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {s.appearances} app{s.appearances === 1 ? "" : "s"} · {s.goals} goal
                  {s.goals === 1 ? "" : "s"} · {s.assists} assist{s.assists === 1 ? "" : "s"} ·{" "}
                  {s.yellow_cards} yellow · {s.red_cards} red
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
