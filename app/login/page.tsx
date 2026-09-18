"use client";

import { FormEvent, useEffect, useState } from "react";
import { Apple, ArrowRight, BookOpen, LoaderCircle, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

type Mode = "login" | "signup";

function friendlyError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email o password non corretti.";
  if (value.includes("email not confirmed")) return "Conferma prima il tuo indirizzo email.";
  if (value.includes("already registered")) return "Esiste già un account con questa email.";
  if (value.includes("provider is not enabled")) return "Questo metodo di accesso non è ancora attivo.";
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("email"); setError(""); setMessage("");
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        router.replace("/");
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (authError) throw authError;
        if (data.session) router.replace("/");
        else setMessage("Controlla la tua email per confermare l’account.");
      }
    } catch (authError) {
      setError(friendlyError(authError instanceof Error ? authError.message : "Accesso non riuscito."));
    } finally { setLoading(null); }
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(provider); setError(""); setMessage("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) {
      setError(friendlyError(authError.message));
      setLoading(null);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span><BookOpen /></span><b>Studify</b></div>
        <div className="auth-heading">
          <h1 id="auth-title">{mode === "login" ? "Bentornato" : "Crea il tuo account"}</h1>
          <p>{mode === "login" ? "Accedi per continuare a studiare." : "Inizia a trasformare i tuoi appunti."}</p>
        </div>

        <div className="auth-socials">
          <button type="button" onClick={() => void handleOAuth("google")} disabled={!!loading}>
            {loading === "google" ? <LoaderCircle className="auth-spin" /> : <span className="google-mark">G</span>}
            Continua con Google
          </button>
          <button type="button" onClick={() => void handleOAuth("apple")} disabled={!!loading}>
            {loading === "apple" ? <LoaderCircle className="auth-spin" /> : <Apple />}
            Continua con Apple
          </button>
        </div>

        <div className="auth-divider"><span>oppure</span></div>

        <form className="auth-form" onSubmit={(event) => void handleEmail(event)}>
          <label><span>Email</span><div><Mail /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@esempio.it" autoComplete="email" required /></div></label>
          <label><span>Password</span><div><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Almeno 6 caratteri" minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></div></label>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {message && <p className="auth-message success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={!!loading}>
            {loading === "email" ? <LoaderCircle className="auth-spin" /> : <>{mode === "login" ? "Accedi" : "Registrati"}<ArrowRight /></>}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? "Non hai un account?" : "Hai già un account?"}
          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>
            {mode === "login" ? "Registrati" : "Accedi"}
          </button>
        </p>
      </section>
    </main>
  );
}
