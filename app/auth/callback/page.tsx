"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { exchangeAuthCode } from "@/app/lib/auth-callback";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function completeSignIn() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) { setError("Link di accesso non valido."); return; }

      const { error: authError } = await exchangeAuthCode(code);
      if (!active) return;
      if (!authError) { router.replace("/"); return; }

      setError("Link scaduto o già utilizzato. Torna all’accesso per riprovare.");
    }
    void completeSignIn().catch(() => { if (active) setError("Connessione non riuscita. Riprova."); });
    return () => { active = false; };
  }, [router]);

  return <main className="auth-page"><section className="auth-callback">
    {error ? <><h1>Accesso non riuscito</h1><p>{error}</p><a href="/login">Torna al login</a></> : <><LoaderCircle className="auth-spin" /><p>Accesso in corso…</p></>}
  </section></main>;
}
