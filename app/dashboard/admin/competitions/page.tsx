import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCompetitionsPage() {
  await requireRole("platform_admin");
  const supabase = await createClient();

  const { data: competitions } = await supabase
    .from("competitions")
    .select("id, name, season, status, description, created_at, organizers(organization_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    name: string;
    season: string | null;
    status: string;
    description: string | null;
    created_at: string;
    organizers: { organization_name: string } | null;
  };
  const rows = (competitions ?? []) as unknown as Row[];

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/admin" className="underline">
          ← Admin dashboard
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">Competitions ({rows.length})</h1>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-zinc-500">
              <th className="pr-4 pb-2 font-medium">Name</th>
              <th className="pr-4 pb-2 font-medium">Organizer</th>
              <th className="pr-4 pb-2 font-medium">Status</th>
              <th className="pr-4 pb-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">
                  <Link href={`/competitions/${c.id}`} target="_blank" className="underline">
                    {c.name}
                    {c.season ? ` (${c.season})` : ""}
                  </Link>
                  {c.description && (
                    <p className="mt-0.5 max-w-xs truncate text-xs text-zinc-500">
                      {c.description}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-4">{c.organizers?.organization_name ?? "—"}</td>
                <td className="py-2 pr-4 capitalize">{c.status}</td>
                <td className="py-2 pr-4 text-zinc-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
