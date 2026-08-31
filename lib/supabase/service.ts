import { createClient } from "@supabase/supabase-js";

// Bypasses RLS entirely -- only for trusted server-only contexts with no
// user session, like a payment provider's webhook. Never import this
// into anything that runs in response to a request from a logged-in
// user's own session; use lib/supabase/server.ts for that.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
