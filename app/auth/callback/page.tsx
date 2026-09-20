"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { exchangeAuthCode } from "@/app/lib/auth-callback";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");

      if (code) {
        const { error: authError } = await exchangeAuthCode(code);
        if (!active) return;
        if (!authError) { router.replace("/"); return; }
        setError("Link scaduto o già utilizzato. Torna all’accesso per riprovare.");
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (!accessToken || !refreshToken) {
        setError("Link di accesso non valido.");
        return;
      }

      const { error: authError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!active) return;
      if (authError) {
        setError("Link scaduto o già utilizzato. Torna all’accesso per riprovare.");
        return;
      }

      window.history.replaceState({}, "", window.location.pathname);
      router.replace("/");
    }

    void completeSignIn().catch(() => {
      if (active) setError("Connessione non riuscita. Riprova.");
    });
    return () => { active = false; };
  }, [router]);

  return <main className="auth-page"><section className="auth-callback">
    {error ? <><h1>Accesso non riuscito</h1><p>{error}</p><a href="/login">Torna al login</a></> : <><LoaderCircle className="auth-spin" /><p>Accesso in corso…</p></>}
  </section></main>;
}
