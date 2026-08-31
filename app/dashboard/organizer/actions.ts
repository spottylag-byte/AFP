"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createOrganizerProfile(organizationName: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("organizers")
    .insert({ profile_id: user.id, organization_name: organizationName });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/organizer");
}

export async function createCompetition(name: string, season: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in");

  const { data: organizer, error: organizerError } = await supabase
    .from("organizers")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (organizerError || !organizer) {
    throw new Error("Set up your organization before creating a competition");
  }

  const { error } = await supabase.from("competitions").insert({
    organizer_id: organizer.id,
    name,
    season: season || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/organizer");
}

export async function initiateCompetitionPayment(
  competitionId: string
): Promise<{ authorizationUrl: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Not signed in" };
  }

  const { data: payment, error: rpcError } = await supabase
    .rpc("create_competition_payment", { p_competition_id: competitionId })
    .single();

  if (rpcError || !payment) {
    return { error: rpcError?.message ?? "Could not start payment" };
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return {
      error:
        "Payment gateway isn't configured yet (no PAYSTACK_SECRET_KEY). Ask an admin to waive this competition's fee instead.",
    };
  }

  const { payment_id, amount } = payment as { payment_id: string; amount: number };

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: Math.round(amount * 100), // kobo
      reference: payment_id,
      callback_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/dashboard/organizer`,
    }),
  });

  const json = await res.json();

  if (!res.ok || !json.status) {
    return { error: json.message ?? "Paystack rejected the payment request" };
  }

  return { authorizationUrl: json.data.authorization_url as string };
}
