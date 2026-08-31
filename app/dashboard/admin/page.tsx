import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import WaiveButton from "./waive-button";

export default async function AdminDashboard() {
  const { fullName } = await requireRole("platform_admin");
  const supabase = await createClient();

  const { data: draftCompetitions } = await supabase
    .from("competitions")
    .select("id, name, season, created_at, organizers(organization_name)")
    .eq("status", "draft")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Admin dashboard</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Welcome, {fullName}. Verification and audit tools land in Phase 8.
      </p>
      <Link
        href="/dashboard/admin/players/new"
        className="mt-4 inline-block rounded bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
      >
        Register a player
      </Link>

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
    </div>
  );
}
