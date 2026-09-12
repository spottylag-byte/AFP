import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PlayerAvatar from "@/components/player-avatar";

export default async function AdminPlayersPage() {
  await requireRole("platform_admin");
  const supabase = await createClient();

  const { data: players } = await supabase
    .from("players")
    .select("id, full_name, alias, position, country, city, photo_url, football_ids(code)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  type Row = {
    id: string;
    full_name: string;
    alias: string | null;
    position: string | null;
    country: string | null;
    city: string | null;
    photo_url: string | null;
    football_ids: { code: string } | null;
  };
  const rows = (players ?? []) as unknown as Row[];

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/admin" className="underline">
          ← Admin dashboard
        </Link>
        {" · "}
        <Link href="/dashboard/admin/players/new" className="underline">
          Register a player
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">Players ({rows.length})</h1>

      <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p, i) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <span className="w-6 shrink-0 text-right text-zinc-400">{i + 1}.</span>
            <PlayerAvatar fullName={p.full_name} photoUrl={p.photo_url} size={40} />
            <div className="min-w-0">
              <Link href={`/players/${p.id}`} target="_blank" className="font-medium underline">
                {p.full_name}
                {p.alias ? ` (${p.alias})` : ""}
              </Link>
              <p className="truncate text-zinc-600 dark:text-zinc-400">
                {p.football_ids?.code}
                {p.position ? ` · ${p.position}` : ""}
                {p.city || p.country
                  ? ` · ${[p.city, p.country].filter(Boolean).join(", ")}`
                  : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
