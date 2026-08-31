"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function waiveCompetitionPayment(competitionId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("waive_competition_payment", {
    p_competition_id: competitionId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
}
