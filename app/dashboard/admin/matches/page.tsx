import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/badge";

export default async function AdminMatchesPage() {
  await requireRole("platform_admin");
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, status, scheduled_at, home_score, away_score, competition_id, home:teams!home_team_id(name), away:teams!away_team_id(name), competitions(name)"
    )
    .order("scheduled_at", { ascending: false })
    .limit(200);

  type Row = {
    id: string;
    status: string;
    scheduled_at: string | null;
    home_score: number | null;
    away_score: number | null;
    competition_id: string;
    home: { name: string } | null;
    away: { name: string } | null;
    competitions: { name: string } | null;
  };
  const rows = (matches ?? []) as unknown as Row[];

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/admin" className="underline">
          ← Admin dashboard
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">Matches ({rows.length})</h1>

      <ul className="mt-6 flex flex-col gap-2">
        {rows.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">
                {m.home?.name ?? "Home"}
                {m.status === "published" && m.home_score !== null && m.away_score !== null
                  ? ` ${m.home_score} - ${m.away_score} `
                  : " vs "}
                {m.away?.name ?? "Away"}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {m.competitions?.name} ·{" "}
                {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "TBD"}
              </p>
            </div>
            {m.status === "published" ? (
              <Badge kind="verified">Published</Badge>
            ) : m.status === "verified" || m.status === "finished" ? (
              <Badge kind="pending">{m.status}</Badge>
            ) : (
              <Badge kind="unverified">{m.status}</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
