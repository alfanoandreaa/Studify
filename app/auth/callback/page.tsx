"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { setError("Link di accesso non valido."); return; }
    void supabase.auth.exchangeCodeForSession(code).then(({ error: authError }) => {
      if (authError) setError("Non è stato possibile completare l’accesso.");
      else router.replace("/");
    });
  }, [router]);

  return <main className="auth-page"><section className="auth-callback">
    {error ? <><h1>Accesso non riuscito</h1><p>{error}</p><a href="/login">Torna al login</a></> : <><LoaderCircle className="auth-spin" /><p>Accesso in corso…</p></>}
  </section></main>;
}
