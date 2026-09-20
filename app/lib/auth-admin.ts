import { createClient } from "@supabase/supabase-js";

function supabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Auth service unavailable");
  return url;
}

export function authAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Auth service unavailable");
  return createClient(supabaseUrl(), secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function authPublic() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error("Auth service unavailable");
  return createClient(supabaseUrl(), publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
}
