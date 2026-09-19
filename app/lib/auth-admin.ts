import { createClient } from "@supabase/supabase-js";

export function authAdmin() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Auth service unavailable");
  return createClient("https://rdxfhjjhvdztchwbqgea.supabase.co", secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function sameOrigin(request: Request) {
  return request.headers.get("origin") === "https://studify.pmxno9868721081uuj91.chatgpt.site";
}
