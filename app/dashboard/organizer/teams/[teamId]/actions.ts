"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function searchExistingPlayerForTeam(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  teamId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_existing_player", {
    p_full_name: `${firstName} ${lastName}`,
    p_date_of_birth: dateOfBirth,
    p_team_id: teamId,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function registerPlayerForTeam(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  teamId: string,
  alias: string | null
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("register_player", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: dateOfBirth,
      p_team_id: teamId,
      p_alias: alias,
    })
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/teams/${teamId}`);
  return data as { id: string; football_id_code: string };
}

export async function addExistingPlayerToTeam(teamId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_existing_player_to_team", {
    p_team_id: teamId,
    p_player_id: playerId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/teams/${teamId}`);
}
