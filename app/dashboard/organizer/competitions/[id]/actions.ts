"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addTeamToCompetition(competitionId: string, teamId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_team_to_competition", {
    p_competition_id: competitionId,
    p_team_id: teamId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/competitions/${competitionId}`);
}

export async function createFixture(
  competitionId: string,
  homeTeamId: string,
  awayTeamId: string,
  scheduledAt: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_fixture", {
    p_competition_id: competitionId,
    p_home_team_id: homeTeamId,
    p_away_team_id: awayTeamId,
    p_scheduled_at: scheduledAt,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/competitions/${competitionId}`);
}
