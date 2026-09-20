import { authAdmin, authPublic } from "@/app/lib/auth-admin";
import { validNewPassword } from "@/app/lib/password-policy";
import { checkRateLimits, clientIpKey, RateLimitUnavailableError } from "@/app/lib/rate-limit";
import { sameOrigin } from "@/app/lib/same-origin";

export const runtime = "edge";

export async function POST(request: Request) {
  const reply = (body: object, status = 200, headers: Record<string, string> = {}) => Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

  if (!sameOrigin(request)) return reply({ error: "Origine non autorizzata." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Richiesta non valida." }, 400);

  try {
    const rate = await checkRateLimits([{
      scope: "register-hour",
      identifier: clientIpKey(request),
      limit: 8,
      windowSeconds: 60 * 60,
    }]);
    if (!rate.allowed) return reply(
      { error: "Troppe richieste. Riprova più tardi." },
      429,
      { "Retry-After": String(rate.retryAfter) },
    );
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return reply({ error: "Servizio di registrazione temporaneamente non disponibile." }, 503);
    }
    throw error;
  }

  let body: { email?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return reply({ error: "Richiesta non valida." }, 400); }

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = body?.password;
  if (
    email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== "string"
    || password.length > 128
    || !validNewPassword(password)
  ) {
    return reply({ error: "Controlla email e requisiti della password." }, 400);
  }

  try {
    const origin = request.headers.get("origin");
    if (!origin) return reply({ error: "Origine non autorizzata." }, 403);

    const { data, error } = await authPublic().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: new URL("/auth/callback", origin).toString() },
    });

    if (error) {
      const duplicate = error.code === "user_already_exists"
        || error.message.toLowerCase().includes("already registered");
      if (duplicate) return reply({ error: "Questa email è già registrata." }, 409);
      console.warn("Studify: registrazione Supabase fallita", error.code || error.status || "unknown");
      return reply({ error: "Registrazione non riuscita. Riprova più tardi." }, 503);
    }

    if (data.user?.identities && data.user.identities.length === 0) {
      return reply({ error: "Questa email è già registrata." }, 409);
    }

    if (data.session && data.user) {
      console.warn("Studify: conferma email Supabase disattivata");
      try {
        await authAdmin().auth.admin.deleteUser(data.user.id, false);
      } catch (cleanupError) {
        console.warn("Studify: pulizia registrazione non confermata fallita", {
          errorName: cleanupError instanceof Error ? cleanupError.name : "unknown",
        });
      }
      return reply({ error: "Registrazione temporaneamente non disponibile." }, 503);
    }

    if (!data.user) return reply({ error: "Registrazione non riuscita. Riprova più tardi." }, 503);
    return reply({ created: true, confirmationRequired: true }, 201);
  } catch (error) {
    console.warn("Studify: servizio registrazione non disponibile", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return reply({ error: "Servizio di registrazione non disponibile. Riprova più tardi." }, 503);
  }
}
