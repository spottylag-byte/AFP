import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTeamsPage() {
  await requireRole("platform_admin");
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select(
      "id, name, created_at, manager:profiles!team_manager_profile_id(first_name, last_name, role), team_players(count)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  type TeamRow = {
    id: string;
    name: string;
    created_at: string;
    manager: { first_name: string; last_name: string; role: string } | null;
    team_players: { count: number }[];
  };

  const rows = (teams ?? []) as unknown as TeamRow[];

  const ROLE_LABELS: Record<string, string> = {
    organizer: "Organizer",
    team_manager: "Team Manager",
    platform_admin: "Admin",
  };

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/admin" className="underline">
          ← Admin dashboard
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">Teams ({rows.length})</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Every team on the platform, including ones onboarded directly by an organizer.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-zinc-500">
              <th className="pr-4 pb-2 font-medium">Team</th>
              <th className="pr-4 pb-2 font-medium">Manager of record</th>
              <th className="pr-4 pb-2 font-medium">Players</th>
              <th className="pr-4 pb-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">
                  <Link href={`/dashboard/admin/teams/${t.id}`} className="underline">
                    {t.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">
                  {t.manager
                    ? `${t.manager.first_name} ${t.manager.last_name} (${
                        ROLE_LABELS[t.manager.role] ?? t.manager.role
                      })`
                    : "—"}
                </td>
                <td className="py-2 pr-4">{t.team_players?.[0]?.count ?? 0}</td>
                <td className="py-2 pr-4 text-zinc-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
