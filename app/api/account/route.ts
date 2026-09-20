import { createClient } from "@supabase/supabase-js";
import { sameOrigin, SUPABASE_URL } from "@/app/lib/site-config";

export const runtime = "edge";
const reply = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return reply("Origine non autorizzata.", 403);
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.length < 8) return reply("Accedi di nuovo per eliminare l’account.", 401);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply("Richiesta non valida.", 400);
  let body: unknown;
  try { body = await request.json(); } catch { return reply("Richiesta non valida.", 400); }
  if (!body || typeof body !== "object" || !("confirmation" in body) || body.confirmation !== "ELIMINA") return reply("Conferma l’eliminazione scrivendo ELIMINA.", 400);
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return reply("Eliminazione non disponibile. Contatta l’assistenza.", 503);
  const admin = createClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const token = authorization.slice(7);
  try {
    // Resolve the target exclusively from the token, never from a client-supplied ID.
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return reply("Sessione non valida. Accedi di nuovo.", 401);
    // Revoke refresh sessions before deletion; issued access tokens can remain
    // cryptographically valid until expiry, so protected APIs must check getUser.
    const { error: logoutError } = await admin.auth.admin.signOut(token, "global");
    if (logoutError) return reply("Impossibile chiudere le sessioni. Riprova più tardi.", 502);
    const { error: deletionError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deletionError) return reply("Account non eliminato. Accedi di nuovo e riprova; se il problema persiste contatta l’assistenza.", 502);
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return reply("Impossibile confermare l’esito dell’eliminazione. Controlla l’accesso prima di riprovare.", 502);
  }
}
