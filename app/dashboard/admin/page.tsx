import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import WaiveButton from "./waive-button";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Admin",
  organizer: "Organizer",
  team_manager: "Team Manager",
  match_operator: "Match Operator",
  player: "Player",
  scout: "Scout",
};

function countBy<T extends string>(rows: { key: T }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.key] = (counts[row.key] ?? 0) + 1;
  }
  return counts;
}

export default async function AdminDashboard() {
  const { fullName } = await requireRole("platform_admin");
  const supabase = await createClient();

  const [
    { data: profileRoles },
    { data: competitionStatuses },
    { count: teamsCount },
    { count: playersCount },
    { data: matchStatuses },
    { data: completedPayments },
    { data: activityRows },
    { data: draftCompetitions },
  ] = await Promise.all([
    supabase.from("profiles").select("role"),
    supabase.from("competitions").select("status"),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("players").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("status"),
    supabase.from("competition_payments").select("amount").eq("status", "completed"),
    supabase
      .from("audit_logs")
      .select("action, entity_type, created_at, actor:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("competitions")
      .select("id, name, season, created_at, organizers(organization_name)")
      .eq("status", "draft")
      .order("created_at", { ascending: false }),
  ]);

  const usersByRole = countBy((profileRoles ?? []).map((r) => ({ key: r.role as string })));
  const totalUsers = (profileRoles ?? []).length;
  const competitionsByStatus = countBy(
    (competitionStatuses ?? []).map((c) => ({ key: c.status as string }))
  );
  const matchesByStatus = countBy((matchStatuses ?? []).map((m) => ({ key: m.status as string })));
  const totalRevenue = (completedPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  type ActivityRow = {
    action: string;
    entity_type: string;
    created_at: string;
    actor: { full_name: string } | null;
  };
  const activity = (activityRows ?? []) as unknown as ActivityRow[];

  return (
    <div>
      <h1 className="text-xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Welcome, {fullName}.</p>

      <div className="mt-4 flex gap-4 text-sm">
        <Link
          href="/dashboard/admin/players/new"
          className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
        >
          Register a player
        </Link>
        <Link
          href="/dashboard/admin/users"
          className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
        >
          Manage users
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{totalUsers}</p>
          <p className="text-xs text-zinc-500">
            Users
            {Object.entries(usersByRole).length > 0 && (
              <span className="block">
                {Object.entries(usersByRole)
                  .map(([role, n]) => `${ROLE_LABELS[role] ?? role}: ${n}`)
                  .join(" · ")}
              </span>
            )}
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{(competitionStatuses ?? []).length}</p>
          <p className="text-xs text-zinc-500">
            Competitions
            <span className="block">
              draft: {competitionsByStatus.draft ?? 0} · published:{" "}
              {competitionsByStatus.published ?? 0}
            </span>
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{teamsCount ?? 0}</p>
          <p className="text-xs text-zinc-500">Teams</p>
        </div>
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{playersCount ?? 0}</p>
          <p className="text-xs text-zinc-500">Players</p>
        </div>
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">{(matchStatuses ?? []).length}</p>
          <p className="text-xs text-zinc-500">
            Matches
            <span className="block">published: {matchesByStatus.published ?? 0}</span>
          </p>
        </div>
        <div className="rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-2xl font-semibold">₦{totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">Revenue (completed)</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">
          Draft competitions awaiting payment
        </h2>
        {!draftCompetitions || draftCompetitions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            None right now.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {draftCompetitions.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium">
                    {c.name}
                    {c.season ? ` (${c.season})` : ""}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {(c.organizers as unknown as { organization_name: string } | null)
                      ?.organization_name ?? "Unknown organizer"}
                  </p>
                </div>
                <WaiveButton competitionId={c.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Nothing yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {activity.map((a, i) => (
              <li key={i} className="text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-900 dark:text-zinc-100">
                  {a.actor?.full_name ?? "System"}
                </span>{" "}
                {a.action.replace(/_/g, " ")} ({a.entity_type}) ·{" "}
                {new Date(a.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
