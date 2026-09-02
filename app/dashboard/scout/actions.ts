"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getOrCreateDefaultShortlist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scoutId: string
) {
  const { data: existing } = await supabase
    .from("shortlists")
    .select("id")
    .eq("scout_profile_id", scoutId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("shortlists")
    .insert({ scout_profile_id: scoutId, name: "My Shortlist" })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function toggleShortlist(playerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");

  const shortlistId = await getOrCreateDefaultShortlist(supabase, user.id);

  const { data: existingRow } = await supabase
    .from("shortlist_players")
    .select("id")
    .eq("shortlist_id", shortlistId)
    .eq("player_id", playerId)
    .maybeSingle();

  if (existingRow) {
    const { error } = await supabase
      .from("shortlist_players")
      .delete()
      .eq("id", existingRow.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("shortlist_players")
      .insert({ shortlist_id: shortlistId, player_id: playerId });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/dashboard/scout");
}
