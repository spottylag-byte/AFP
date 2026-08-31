import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

// Twilio's signature: HMAC-SHA1(authToken, url + sorted-concatenated
// "key"+"value" pairs from the POST body), base64-encoded. See
// https://www.twilio.com/docs/usage/security#validating-requests
function verifyTwilioSignature(
  url: string,
  params: URLSearchParams,
  authToken: string,
  signature: string
): boolean {
  const sortedKeys = Array.from(params.keys()).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params.get(key);
  }
  const expected = crypto.createHmac("sha1", authToken).update(data, "utf-8").digest("base64");
  return expected === signature;
}

const EVENT_KEYWORDS: Record<string, string> = {
  GOAL: "goal",
  OWNGOAL: "own_goal",
  YELLOW: "yellow_card",
  RED: "red_card",
};

function parseCommand(body: string): { eventType: string; playerCode: string; minute: number | null } | null {
  const parts = body.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const eventType = EVENT_KEYWORDS[parts[0].toUpperCase()];
  if (!eventType) return null;

  const playerCode = parts[1].toUpperCase();
  const minute = parts[2] ? parseInt(parts[2], 10) : null;

  return { eventType, playerCode, minute: Number.isNaN(minute) ? null : minute };
}

function twiml(message: string) {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = request.headers.get("x-twilio-signature");
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  if (!authToken || !signature) {
    return new Response("WhatsApp bot not configured", { status: 401 });
  }

  if (!verifyTwilioSignature(request.url, params, authToken, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const from = (params.get("From") ?? "").replace(/^whatsapp:/, "");
  const body = params.get("Body") ?? "";
  const messageSid = params.get("MessageSid") ?? params.get("SmsMessageSid") ?? "";

  const parsed = parseCommand(body);
  if (!parsed) {
    return twiml(
      "Sorry, I didn't understand that. Send e.g. \"GOAL AF-0000002 34\" (event, player's Football ID, minute)."
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .rpc("record_match_event_from_whatsapp", {
      p_sender_whatsapp_number: from,
      p_player_identifier: parsed.playerCode,
      p_event_type: parsed.eventType,
      p_minute: parsed.minute,
      p_provider_message_id: messageSid || null,
    })
    .single();

  if (error) {
    console.error("WhatsApp event RPC failed", error);
    return twiml("Something went wrong recording that. Please try again.");
  }

  const result = data as { result_status: string; result_message: string; result_match_id: string | null };
  return twiml(result.result_message);
}
