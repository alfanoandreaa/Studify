import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/app/lib/site-config";

const supabaseUrl = SUPABASE_URL;
const supabasePublishableKey = "sb_publishable_ITuNYxbjhH84r8s3kftaLA_o-txrLXZ";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
