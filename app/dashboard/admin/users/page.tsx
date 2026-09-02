import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import RoleChangeForm from "./role-change-form";
import DeactivateButton from "./deactivate-button";
import GrantPremiumButton from "./grant-premium-button";
import type { UserRole } from "@/lib/roles";

export default async function AdminUsersPage() {
  const { user } = await requireRole("platform_admin");

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

  const { data: organizerRows } = await supabase
    .from("organizers")
    .select("id, profile_id, tier, premium_until");

  type OrganizerRow = {
    id: string;
    profile_id: string;
    tier: string;
    premium_until: string | null;
  };
  const organizerByProfileId = new Map(
    ((organizerRows ?? []) as OrganizerRow[]).map((o) => [o.profile_id, o])
  );

  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  const bannedById = new Map(
    (authUsers?.users ?? []).map((u) => [
      u.id,
      Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
    ])
  );

  const rows = ((profiles ?? []) as Profile[]).map((p) => {
    const organizer = organizerByProfileId.get(p.id);
    const isPremium = Boolean(
      organizer?.tier === "premium" &&
        organizer.premium_until &&
        new Date(organizer.premium_until) > new Date()
    );
    return {
      ...p,
      email: emailById.get(p.id) ?? "—",
      deactivated: bannedById.get(p.id) ?? false,
      organizerId: organizer?.id ?? null,
      isPremium,
    };
  });

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
              <th className="pr-4 pb-2 font-medium">Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-4">
                  {r.first_name} {r.last_name}
                  {r.deactivated && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-500">
                      Deactivated
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{r.email}</td>
                <td className="py-2 pr-4">
                  <RoleChangeForm profileId={r.id} currentRole={r.role} />
                </td>
                <td className="py-2 pr-4 text-zinc-500">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-col items-start gap-1">
                    {r.id !== user.id && (
                      <DeactivateButton profileId={r.id} deactivated={r.deactivated} />
                    )}
                    {r.organizerId && (
                      <GrantPremiumButton
                        organizerId={r.organizerId}
                        isPremium={r.isPremium}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
