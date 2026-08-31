import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import RoleChangeForm from "./role-change-form";
import type { UserRole } from "@/lib/roles";

export default async function AdminUsersPage() {
  await requireRole("platform_admin");

  // Email lives only in auth.users, never denormalized into profiles --
  // this is the one admin-only view that needs the service-role client
  // to see it, gated by the requireRole check above, same pattern as
  // the WhatsApp webhook route.
  const serviceClient = createServiceClient();
  const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role, created_at")
    .order("created_at", { ascending: false });

  type Profile = {
    id: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    created_at: string;
  };

  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? "—"]));

  const rows = ((profiles ?? []) as Profile[]).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? "—",
  }));

  return (
    <div>
      <p className="text-sm">
        <Link href="/dashboard/admin" className="underline">
          ← Admin dashboard
        </Link>
      </p>
      <h1 className="mt-2 text-xl font-semibold">Users ({rows.length})</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Role changes are audited (see Recent activity on the admin dashboard) — never a raw
        edit.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-zinc-500">
              <th className="pr-4 pb-2 font-medium">Name</th>
              <th className="pr-4 pb-2 font-medium">Email</th>
              <th className="pr-4 pb-2 font-medium">Role</th>
              <th className="pr-4 pb-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">
                  {r.first_name} {r.last_name}
                </td>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4">
                  <RoleChangeForm profileId={r.id} currentRole={r.role} />
                </td>
                <td className="py-2 pr-4 text-zinc-500">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
