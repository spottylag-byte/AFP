"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setLineup(matchId: string, teamId: string, playerIds: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_match_lineup", {
    p_match_id: matchId,
    p_team_id: teamId,
    p_player_ids: playerIds,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/match-operator/matches/${matchId}`);
}

export async function startMatch(matchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_match", { p_match_id: matchId });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/match-operator/matches/${matchId}`);
}

export async function recordEvent(
  matchId: string,
  playerId: string,
  eventType: string,
  minute: number | null,
  dedupKey: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_match_event", {
    p_match_id: matchId,
    p_player_id: playerId,
    p_event_type: eventType,
    p_minute: minute,
    p_dedup_key: dedupKey,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/match-operator/matches/${matchId}`);
}

export async function finishMatch(matchId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_match", { p_match_id: matchId });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/match-operator/matches/${matchId}`);
  revalidatePath("/dashboard/match-operator");
}
