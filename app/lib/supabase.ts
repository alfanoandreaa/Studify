import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://rdxfhjjhvdztchwbqgea.supabase.co";
const supabasePublishableKey = "sb_publishable_ITuNYxbjhH84r8s3kftaLA_o-txrLXZ";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
