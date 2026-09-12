"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimPlayerProfile(footballIdCode: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_player_profile", {
    p_football_id_code: footballIdCode,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/player");
}

export async function confirmPlayerPhoto(playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_player_photo", { p_player_id: playerId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/player");
}

export async function confirmPlayerVideo(videoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_player_video", { p_video_id: videoId });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/player");
}
