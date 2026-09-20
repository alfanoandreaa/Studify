import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sameOrigin } from "@/app/lib/site-config";
export { sameOrigin };

export function authAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Auth service unavailable");
  return createClient(SUPABASE_URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
