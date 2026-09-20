"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { passwordRequirements, validNewPassword } from "@/app/lib/password-policy";
import { ThemeToggle } from "@/app/components/theme-toggle";

function friendlyError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email o password errati.";
  if (value.includes("email not confirmed")) return "Conferma la tua email dal link ricevuto prima di accedere.";
  if (value.includes("rate limit") || value.includes("security purposes")) return "Troppe richieste. Attendi qualche minuto prima di riprovare.";
  if (value.includes("signups not allowed") || value.includes("email provider is disabled")) return "La registrazione non è disponibile al momento. Riprova più tardi.";
  if (value.includes("password")) return "Controlla la password. Per registrarti deve rispettare tutti i requisiti indicati.";
  if (value.includes("fetch") || value.includes("network")) return "Connessione al servizio non riuscita. Controlla la rete e riprova.";
  return "Non è stato possibile completare la richiesta. Riprova tra poco.";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const duplicateMessage = "Questa email è già registrata. Accedi con la tua password.";
  function changeMode(next: "login" | "signup") {
    setMode(next); setConfirmation(""); setError(""); setMessage("");
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const deletion = new URLSearchParams(window.location.search).get("deleted");
      if (deletion === "success") setMessage("Account eliminato. Puoi registrarti di nuovo, anche con la stessa email.");
      if (deletion === "local-cleanup-needed") setMessage("Account eliminato. Per rimuovere anche i dati locali, cancella i dati di questo sito nelle impostazioni del browser.");
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session) router.replace("/");
      } catch {
        if (!cancelled) setError("Impossibile verificare la sessione. Riprova ad accedere.");
      }
    });
    return () => { cancelled = true; };
  }, [router]);

  async function run(action: string, operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setLoading(action); setError(""); setMessage("");
    try { await operation(); }
    catch (failure) { setError(friendlyError(failure && typeof failure === "object" && "message" in failure && typeof failure.message === "string" ? failure.message : "")); }
    finally { busy.current = false; setLoading(null); }
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "signup" && (!validNewPassword(password) || password !== confirmation)) {
      setError("Completa i requisiti e inserisci due password uguali."); return;
    }
    await run("email", async () => {
      if (mode === "login") {
        const { data, error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) throw failure;
        if (!data.session) throw new Error("Missing session");
        router.replace("/");
      } else {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
        if (response.status === 409) { setError(duplicateMessage); return; }
        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error || "network");
        }
        setPassword(""); setConfirmation("");
        setMode("login");
        setMessage("Controlla la tua email e conferma l’indirizzo dal link ricevuto, poi accedi.");
      }
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span><BookOpen /></span><b>Studify</b></div>
        <div className="auth-heading">
          <h1 id="auth-title">{mode === "login" ? "Bentornato" : "Crea il tuo account"}</h1>
          <p>{mode === "signup" ? "Crea un account con email e password. Riceverai un link di conferma." : "Accedi con email e password."}</p>
        </div>
        <form className="auth-form" onSubmit={(event) => void handleEmail(event)} aria-busy={!!loading}>
          <label><span>Email</span><div><input type="email" autoComplete="email" required disabled={!!loading} value={email} onChange={(event) => { setEmail(event.target.value); setMessage(""); setError(""); }} placeholder="nome@esempio.it" /></div></label>
          <label><span>Password</span><div><input type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required disabled={!!loading} value={password} aria-describedby={mode === "signup" ? "password-rules" : undefined} onChange={(event) => setPassword(event.target.value)} /><button className="auth-reveal" type="button" aria-label={showPassword ? "Nascondi password" : "Mostra password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {mode === "signup" && <>
            <ul id="password-rules" className="auth-password-rules">{passwordRequirements(password).map((rule) => <li key={rule.label} className={rule.valid ? "met" : ""}>{rule.valid ? "✓" : "○"} {rule.label}</li>)}</ul>
            <label><span>Conferma password</span><div><input type={showPassword ? "text" : "password"} autoComplete="new-password" required disabled={!!loading} value={confirmation} aria-invalid={!!confirmation && password !== confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div></label>
            {!!confirmation && password !== confirmation && <p className="auth-message error">Le password non coincidono.</p>}
          </>}
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {mode === "signup" && error === duplicateMessage && <div className="auth-help-actions"><button type="button" onClick={() => changeMode("login")}>Accedi</button></div>}
          {mode === "signup" && <p className="auth-password-note">Dopo la registrazione dovrai confermare l’indirizzo email prima di accedere.</p>}
          {message && <p className="auth-message success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={!!loading}>{loading === "email" ? <><LoaderCircle className="auth-spin" />Attendi…</> : mode === "login" ? "Accedi" : "Registrati"}</button>
        </form>
        <p className="auth-switch">{mode === "login" ? "Non hai un account?" : "Hai già un account?"}<button type="button" disabled={!!loading} onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Registrati" : "Accedi"}</button></p>
        <div className="auth-theme"><ThemeToggle /></div>
      </section>
    </main>
  );
}
