import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WhatsAppShareLink from "@/components/whatsapp-share-link";

export default async function PublicTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: teamId } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name")
    .eq("id", teamId)
    .is("deleted_at", null)
    .single();

  if (!team) {
    notFound();
  }

  const { data: rosterRows } = await supabase
    .from("team_players")
    .select("player_id, players(full_name, alias)")
    .eq("team_id", teamId)
    .is("left_at", null);

  type RosterRow = { player_id: string; players: { full_name: string; alias: string | null } | null };
  const roster = (rosterRows ?? []) as unknown as RosterRow[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/" className="underline">
          African Football Platform
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{team.name}</h1>
      <div className="mt-3">
        <WhatsAppShareLink path={`/teams/${teamId}`} text={`Check out ${team.name}:`} />
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Squad ({roster.length})</h2>
        {roster.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No players registered yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {roster.map((r) => (
              <li key={r.player_id}>
                <Link href={`/players/${r.player_id}`} className="underline">
                  {r.players?.full_name}
                  {r.players?.alias ? ` (${r.players.alias})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
