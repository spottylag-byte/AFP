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

export async function searchExistingPlayerForTeam(
  fullName: string,
  dateOfBirth: string,
  teamId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_existing_player", {
    p_full_name: fullName,
    p_date_of_birth: dateOfBirth,
    p_team_id: teamId,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function registerPlayerForTeam(
  fullName: string,
  dateOfBirth: string,
  teamId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("register_player", {
      p_full_name: fullName,
      p_date_of_birth: dateOfBirth,
      p_team_id: teamId,
    })
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team-manager");
  return data as { id: string; football_id_code: string };
}

export async function addExistingPlayerToTeam(teamId: string, playerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_existing_player_to_team", {
    p_team_id: teamId,
    p_player_id: playerId,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/team-manager");
}
