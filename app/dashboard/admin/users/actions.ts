"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { UserRole } from "@/lib/roles";

export async function changeUserRole(profileId: string, newRole: UserRole) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_change_user_role", {
    p_profile_id: profileId,
    p_new_role: newRole,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/users");
}

// Deactivation, not deletion: a hard-delete fails for any account with real
// history anyway (audit_logs is immutable and foreign-keys to the actor),
// and blocking login is the actual founder need here. The auth.admin call
// needs the service-role client, so this action re-checks platform_admin
// itself rather than relying on RLS -- same defence-in-depth requirement
// as every other server function in this project.
export async function setUserDeactivated(profileId: string, deactivated: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  if (profileId === user.id) {
    throw new Error("You cannot deactivate your own account");
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "platform_admin") {
    throw new Error("Only platform_admin may deactivate a user");
  }

  const serviceClient = createServiceClient();
  const { error: authError } = await serviceClient.auth.admin.updateUserById(profileId, {
    ban_duration: deactivated ? "876000h" : "none",
  });
  if (authError) throw new Error(authError.message);

  const { error: logError } = await supabase.rpc("log_admin_user_deactivation", {
    p_profile_id: profileId,
    p_deactivated: deactivated,
  });
  if (logError) throw new Error(logError.message);

  revalidatePath("/dashboard/admin/users");
}
