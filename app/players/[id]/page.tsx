import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsAppShareLink from "@/components/whatsapp-share-link";
import PlayerAvatar from "@/components/player-avatar";

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
    .select("id, full_name, alias, photo_url, photo_confirmed_by_player, football_ids(code)")
    .eq("id", playerId)
    .is("deleted_at", null)
    .single();

  type Player = {
    id: string;
    full_name: string;
    alias: string | null;
    photo_url: string | null;
    photo_confirmed_by_player: boolean;
    football_ids: { code: string } | null;
  };
  const p = player as unknown as Player | null;

  if (!p) {
    notFound();
  }

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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          African Football Platform
        </Link>
      </p>
      <div className="mt-2 flex items-center gap-3">
        <PlayerAvatar fullName={p.full_name} photoUrl={p.photo_url} size={56} />
        <div>
          <h1 className="text-2xl font-semibold">
            {p.full_name}
            {p.alias ? <span className="text-zinc-500"> &quot;{p.alias}&quot;</span> : ""}
          </h1>
          {p.photo_url && p.photo_confirmed_by_player && (
            <p className="text-xs text-primary-hover">✓ Photo confirmed by player</p>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm font-mono text-zinc-600 dark:text-zinc-400">
        {p.football_ids?.code}
      </p>
      <div className="mt-3">
        <WhatsAppShareLink path={`/players/${playerId}`} text={`Check out ${p.full_name}:`} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Career (verified statistics)</h2>
        <p className="mt-2 text-sm">
          {career.appearances} appearance{career.appearances === 1 ? "" : "s"} ·{" "}
          {career.goals} goal{career.goals === 1 ? "" : "s"} · {career.assists} assist
          {career.assists === 1 ? "" : "s"} · {career.yellow_cards} yellow ·{" "}
          {career.red_cards} red
        </p>
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
