"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTeam(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("teams")
    .insert({ name, team_manager_profile_id: user.id });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team-manager");
}
