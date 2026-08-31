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

export async function assignMatchOperator(
  competitionId: string,
  matchId: string,
  operatorProfileId: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_match_operator", {
    p_match_id: matchId,
    p_operator_profile_id: operatorProfileId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/competitions/${competitionId}`);
}

export async function verifyAndPublishMatch(competitionId: string, matchId: string) {
  const supabase = await createClient();

  const { error: verifyError } = await supabase.rpc("verify_match", { p_match_id: matchId });
  if (verifyError) throw new Error(verifyError.message);

  const { error: publishError } = await supabase.rpc("publish_match", { p_match_id: matchId });
  if (publishError) throw new Error(publishError.message);

  revalidatePath(`/dashboard/organizer/competitions/${competitionId}`);
}

export async function flagDispute(competitionId: string, eventId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("flag_event_dispute", {
    p_event_id: eventId,
    p_reason: reason,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/competitions/${competitionId}`);
}

export async function approveCorrection(
  competitionId: string,
  correctionRequestId: string,
  correctedEventType: string | null,
  correctedPlayerId: string | null,
  reviewNotes: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_correction", {
    p_correction_request_id: correctionRequestId,
    p_corrected_event_type: correctedEventType,
    p_corrected_player_id: correctedPlayerId,
    p_corrected_minute: null,
    p_review_notes: reviewNotes || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/organizer/competitions/${competitionId}`);
}

export async function rejectCorrection(
  competitionId: string,
  correctionRequestId: string,
  reviewNotes: string
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_correction", {
    p_correction_request_id: correctionRequestId,
    p_review_notes: reviewNotes,
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
