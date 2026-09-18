"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function completeSignIn() {
      const { data: current } = await supabase.auth.getSession();
      if (!active) return;
      if (current.session) { router.replace("/"); return; }

      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) { setError("Link di accesso non valido."); return; }

      const { error: authError } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (!authError) { router.replace("/"); return; }

      const { data: confirmed } = await supabase.auth.getSession();
      if (confirmed.session) router.replace("/");
      else setError("Non è stato possibile completare l’accesso.");
    }
    void completeSignIn();
    return () => { active = false; };
  }, [router]);

  return <main className="auth-page"><section className="auth-callback">
    {error ? <><h1>Accesso non riuscito</h1><p>{error}</p><a href="/login">Torna al login</a></> : <><LoaderCircle className="auth-spin" /><p>Accesso in corso…</p></>}
  </section></main>;
}
