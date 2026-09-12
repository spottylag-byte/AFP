"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Shared by every "register a player" surface (admin standalone,
// team_manager roster, organizer roster) -- previously copy-pasted
// three times and drifting every time a field got added.

export async function searchExistingPlayer(
  firstName: string,
  lastName: string,
  dateOfBirth: string,
  teamId?: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_existing_player", {
    p_full_name: `${firstName} ${lastName}`,
    p_date_of_birth: dateOfBirth,
    p_team_id: teamId ?? null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export type RegisterPlayerInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  teamId?: string;
  alias: string | null;
  position: string | null;
  heightCm: number | null;
  preferredFoot: string | null;
  country: string | null;
  city: string | null;
};

export async function registerPlayer(input: RegisterPlayerInput, revalidatePathTarget: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("register_player", {
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_date_of_birth: input.dateOfBirth,
      p_team_id: input.teamId ?? null,
      p_alias: input.alias,
      p_position: input.position,
      p_height_cm: input.heightCm,
      p_preferred_foot: input.preferredFoot,
      p_country: input.country,
      p_city: input.city,
    })
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(revalidatePathTarget);
  return data as { id: string; football_id_code: string };
}

export async function addExistingPlayerToTeam(
  teamId: string,
  playerId: string,
  revalidatePathTarget: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_existing_player_to_team", {
    p_team_id: teamId,
    p_player_id: playerId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(revalidatePathTarget);
}
