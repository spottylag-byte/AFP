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
  alias: string | null,
  position: string | null,
  heightCm: number | null,
  preferredFoot: string | null
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("register_player", {
      p_first_name: firstName,
      p_last_name: lastName,
      p_date_of_birth: dateOfBirth,
      p_team_id: teamId,
      p_alias: alias,
      p_position: position,
      p_height_cm: heightCm,
      p_preferred_foot: preferredFoot,
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
