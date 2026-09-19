import { authAdmin, sameOrigin } from "@/app/lib/auth-admin";
export const runtime = "edge";
// Best-effort per-worker burst protection; not a substitute for an edge-wide WAF rule.
const bursts = new Map<string, { count: number; expires: number }>();
export async function POST(request: Request) {
  const respond = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return respond({ error: "Origine non autorizzata." }, 403);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) {
    const now = Date.now();
    for (const [key, burst] of bursts) if (burst.expires <= now) bursts.delete(key);
    const burst = bursts.get(ip) ?? { count: 0, expires: now + 60000 };
    if (++burst.count > 20 || bursts.size > 10000) return respond({ error: "Troppe richieste. Riprova tra un minuto." }, 429);
    bursts.set(ip, burst);
  }
  let email: unknown;
  try { const body = await request.json() as { email?: unknown }; email = body?.email; } catch { return respond({ error: "Richiesta non valida." }, 400); }
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond({ error: "Email non valida." }, 400);
  try {
    const admin = authAdmin();
    // Deliberate existence disclosure requested by the product owner. Never return user records.
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      if (data.users.some(user => user.email?.toLowerCase() === email.toLowerCase())) return respond({ exists: true });
      if (data.users.length < 1000) return respond({ exists: false });
    }
  } catch { return respond({ error: "Impossibile verificare l’account. Riprova tra poco." }, 503); }
}
