"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
