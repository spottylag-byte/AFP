import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();

  if (!secret || !signature) {
    return new Response("Missing signature or secret", { status: 401 });
  }

  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (expected !== signature) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event !== "charge.success") {
    return new Response("ignored", { status: 200 });
  }

  const paymentId = event.data.reference as string;
  const supabase = createServiceClient();

  // Conditional UPDATE (only WHERE status='pending') makes this
  // idempotent: a duplicate webhook delivery for an already-completed
  // payment matches zero rows and is a no-op, never double-processed.
  const { data: updated, error } = await supabase
    .from("competition_payments")
    .update({ status: "completed" })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("competition_id")
    .maybeSingle();

  if (error) {
    console.error("Paystack webhook: failed to update payment", error);
    return new Response("error", { status: 500 });
  }

  if (updated) {
    await supabase
      .from("competitions")
      .update({ status: "published" })
      .eq("id", updated.competition_id)
      .eq("status", "draft");

    await supabase.from("audit_logs").insert({
      actor_id: null,
      action: "competition_payment_completed",
      entity_type: "competitions",
      entity_id: updated.competition_id,
      details: { payment_id: paymentId, source: "paystack_webhook" },
    });

    return new Response("ok", { status: 200 });
  }

  // Not a competition payment reference -- try a subscription payment
  // (a UUID from a different table, so no collision risk between the
  // two conditional updates).
  const { data: subUpdated, error: subError } = await supabase
    .from("organizer_subscription_payments")
    .update({ status: "completed" })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("organizer_id")
    .maybeSingle();

  if (subError) {
    console.error("Paystack webhook: failed to update subscription payment", subError);
    return new Response("error", { status: 500 });
  }

  if (!subUpdated) {
    return new Response("ok", { status: 200 });
  }

  const { data: organizer } = await supabase
    .from("organizers")
    .select("premium_until")
    .eq("id", subUpdated.organizer_id)
    .single();

  const base =
    organizer?.premium_until && new Date(organizer.premium_until) > new Date()
      ? new Date(organizer.premium_until)
      : new Date();
  const newUntil = new Date(base);
  newUntil.setMonth(newUntil.getMonth() + 1);

  await supabase
    .from("organizers")
    .update({ tier: "premium", premium_until: newUntil.toISOString() })
    .eq("id", subUpdated.organizer_id);

  await supabase.from("audit_logs").insert({
    actor_id: null,
    action: "premium_subscription_payment_completed",
    entity_type: "organizers",
    entity_id: subUpdated.organizer_id,
    details: { payment_id: paymentId, source: "paystack_webhook", premium_until: newUntil },
  });

  return new Response("ok", { status: 200 });
}
