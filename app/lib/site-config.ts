export const SITE_URL = "https://studify.pmxno9868721081uuj91.chatgpt.site";
export const SUPABASE_URL = "https://rdxfhjjhvdztchwbqgea.supabase.co";

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Use the actual request host so a verified custom domain can work without
  // hardcoding a second allowlist or accepting an arbitrary caller origin.
  return origin !== null && origin === new URL(request.url).origin;
}
