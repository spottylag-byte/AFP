import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsAppShareLink from "@/components/whatsapp-share-link";

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
    .select("id, full_name, football_ids(code)")
    .eq("id", playerId)
    .is("deleted_at", null)
    .single();

  type Player = { id: string; full_name: string; football_ids: { code: string } | null };
  const p = player as unknown as Player | null;

  if (!p) {
    notFound();
  }

  const { data: statRows } = await supabase
    .from("player_competition_stats")
    .select("goals, appearances, yellow_cards, red_cards, competitions(id, name, season)")
    .eq("player_id", playerId);

  type StatRow = {
    goals: number;
    appearances: number;
    yellow_cards: number;
    red_cards: number;
    competitions: { id: string; name: string; season: string | null } | null;
  };
  const stats = (statRows ?? []) as unknown as StatRow[];

  const career = stats.reduce(
    (acc, s) => ({
      goals: acc.goals + s.goals,
      appearances: acc.appearances + s.appearances,
      yellow_cards: acc.yellow_cards + s.yellow_cards,
      red_cards: acc.red_cards + s.red_cards,
    }),
    { goals: 0, appearances: 0, yellow_cards: 0, red_cards: 0 }
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          African Football Platform
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{p.full_name}</h1>
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
          {career.goals} goal{career.goals === 1 ? "" : "s"} · {career.yellow_cards} yellow ·{" "}
          {career.red_cards} red
        </p>
      </div>

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
                  {s.goals === 1 ? "" : "s"} · {s.yellow_cards} yellow · {s.red_cards} red
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
