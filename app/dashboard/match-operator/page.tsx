import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function MatchOperatorDashboard() {
  const { user, fullName } = await requireRole("match_operator");
  const supabase = await createClient();

  const { data: matchRows } = await supabase
    .from("matches")
    .select(
      "id, scheduled_at, status, home:teams!home_team_id(name), away:teams!away_team_id(name)"
    )
    .eq("assigned_operator_profile_id", user.id)
    .neq("status", "finished")
    .order("scheduled_at", { ascending: true });

  type MatchRow = {
    id: string;
    scheduled_at: string | null;
    status: string;
    home: { name: string } | null;
    away: { name: string } | null;
  };
  const matches = (matchRows ?? []) as unknown as MatchRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Match operator dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Welcome, {fullName}.</p>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Your assigned matches ({matches.length})
        </h2>
        {matches.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No matches assigned to you yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/dashboard/match-operator/matches/${m.id}`}
                  className="block rounded border border-zinc-200 p-3 text-sm hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                >
                  <p className="font-medium">
                    {m.home?.name} vs {m.away?.name}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "TBD"} ·
                    Status: {m.status}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
