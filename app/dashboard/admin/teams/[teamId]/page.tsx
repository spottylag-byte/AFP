import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  await requireRole("platform_admin");
  const { teamId } = await params;
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select(
      "id, name, created_at, manager:profiles!team_manager_profile_id(id, first_name, last_name, role)"
    )
    .eq("id", teamId)
    .maybeSingle();

  if (!team) notFound();

  const manager = team.manager as unknown as {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null;

  const { data: roster } = await supabase
    .from("team_players")
    .select(
      "joined_at, left_at, players(id, full_name, alias, date_of_birth, football_ids(code))"
    )
    .eq("team_id", teamId)
    .order("joined_at", { ascending: false });

  type RosterRow = {
    joined_at: string;
    left_at: string | null;
    players: {
      id: string;
      full_name: string;
      alias: string | null;
      date_of_birth: string;
      football_ids: { code: string } | null;
    } | null;
  };

  const rosterRows = (roster ?? []) as unknown as RosterRow[];

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/admin/teams" className="underline">
          ← Teams
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">{team.name}</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Manager of record: {manager ? `${manager.first_name} ${manager.last_name}` : "—"}
        {manager && (
          <span className="ml-1 text-zinc-500">
            ({manager.role === "organizer" ? "Organizer" : "Team Manager"})
          </span>
        )}
        {" · "}
        Created {new Date(team.created_at).toLocaleDateString()}
      </p>
      <p className="mt-1 text-sm">
        <a
          href={`/teams/${team.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          View public page
        </a>
      </p>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Roster history ({rosterRows.length})
        </h2>
        {rosterRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No players yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rosterRows.map((r, i) => (
              <li
                key={i}
                className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
              >
                <p className="font-medium">
                  <Link href={`/players/${r.players?.id}`} className="underline">
                    {r.players?.full_name}
                  </Link>
                  {r.players?.alias ? ` (${r.players.alias})` : ""}
                  {r.left_at && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      left {new Date(r.left_at).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Born {r.players?.date_of_birth} · {r.players?.football_ids?.code}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
