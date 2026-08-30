import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_PATH_BY_ROLE, type UserRole } from "@/lib/roles";

// Server-side gate for a role-specific dashboard route: redirects to /login
// with no session, or to the caller's own dashboard if their role doesn't
// match. This is defense in depth alongside RLS, per the spec's golden
// rule that the frontend is never the authority on permissions.
export async function requireRole(allowed: UserRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const role = profile?.role as UserRole | undefined;

  if (role !== allowed) {
    redirect(role ? DASHBOARD_PATH_BY_ROLE[role] : "/login");
  }

  return { user, fullName: profile!.full_name as string };
}
