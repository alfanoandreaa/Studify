import { authAdmin, sameOrigin } from "@/app/lib/auth-admin";
import { validNewPassword } from "@/app/lib/password-policy";

export const runtime = "edge";

// Limit automated account creation per edge instance. An edge-wide rule is
// still needed if the app starts receiving significant signup traffic.
const attempts = new Map<string, { count: number; expires: number }>();

export async function POST(request: Request) {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return reply({ error: "Origine non autorizzata." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Richiesta non valida." }, 400);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const attempt = attempts.get(ip) ?? { count: 0, expires: now + 60 * 60 * 1000 };
    if (++attempt.count > 8 || attempts.size > 10000) return reply({ error: "Troppe richieste. Riprova più tardi." }, 429);
    attempts.set(ip, attempt);
  }
  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return reply({ error: "Richiesta non valida." }, 400); }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body?.password;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length > 128 || !validNewPassword(password)) {
    return reply({ error: "Controlla email e requisiti della password." }, 400);
  }
  try {
    // Admin creation confirms the address without sending any message.
    // The admin key never leaves this server route.
    const { error } = await authAdmin().auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists" || error.message.toLowerCase().includes("already registered")) return reply({ error: "Questa email è già registrata." }, 409);
      console.warn("Studify: registrazione fallita", error.code || error.status || "unknown");
      return reply({ error: "Registrazione non riuscita. Riprova più tardi." }, 503);
    }
    return reply({ created: true }, 201);
  } catch {
    return reply({ error: "Servizio di registrazione non disponibile. Riprova più tardi." }, 503);
  }
}
