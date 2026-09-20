"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { BookOpen, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { passwordRequirements, validNewPassword } from "@/app/lib/password-policy";
import { ThemeToggle } from "@/app/components/theme-toggle";

function friendlyError(message: string) {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Password non corretta. Controlla i dati e riprova.";
  if (value.includes("email not confirmed")) return "Questo account è ancora in attesa di conferma. Contatta l’assistenza.";
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
  const [notFound, setNotFound] = useState(false);
  const duplicateMessage = "Questa email è già registrata. Accedi con la tua password.";
  function changeMode(next: "login" | "signup") {
    setMode(next); setConfirmation(""); setError(""); setMessage(""); setNotFound(false);
  }
  async function accountExists() {
    const response = await fetch("/api/auth/account-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
    const result = await response.json() as { exists?: boolean };
    if (!response.ok || typeof result.exists !== "boolean") throw new Error("network");
    return result.exists as boolean;
  }

  useEffect(() => {
    const deletion = new URLSearchParams(window.location.search).get("deleted");
    if (deletion === "success") queueMicrotask(() => setMessage("Account eliminato. Puoi registrarti di nuovo, anche con la stessa email."));
    if (deletion === "local-cleanup-needed") queueMicrotask(() => setMessage("Account eliminato. Per rimuovere anche i dati locali, cancella i dati di questo sito nelle impostazioni del browser."));
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    }).catch(() => setError("Impossibile verificare la sessione. Riprova ad accedere."));
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
      setNotFound(false);
      if (mode === "login") {
        const { data, error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) {
          if (failure.code === "invalid_credentials" || failure.message.includes("Invalid login credentials")) {
            if (!(await accountExists())) { setError("Account non trovato"); setNotFound(true); return; }
          }
          throw failure;
        }
        if (!data.session) throw new Error("Missing session");
        router.replace("/");
      } else {
        if (await accountExists()) { setError(duplicateMessage); return; }
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
        if (response.status === 409) { setError(duplicateMessage); return; }
        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error || "network");
        }
        setPassword(""); setConfirmation("");
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (!loginError && data.session) { router.replace("/"); return; }
        setMode("login");
        setMessage("Account creato. Accedi con la password che hai scelto.");
      }
    });
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><span><BookOpen /></span><b>Studify</b></div>
        <div className="auth-heading">
          <h1 id="auth-title">{mode === "login" ? "Bentornato" : "Crea il tuo account"}</h1>
          <p>{mode === "signup" ? "Crea un account con email e password, senza conferma via email." : "Accedi con email e password."}</p>
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
          {notFound && <button type="button" onClick={() => changeMode("signup")}>Registrati</button>}
          {mode === "signup" && error === duplicateMessage && <div className="auth-help-actions"><button type="button" onClick={() => changeMode("login")}>Accedi</button></div>}
          {mode === "signup" && <p className="auth-password-note">Conserva la password: senza email di recupero non potrai reimpostarla.</p>}
          {message && <p className="auth-message success" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={!!loading}>{loading === "email" ? <><LoaderCircle className="auth-spin" />Attendi…</> : mode === "login" ? "Accedi" : "Registrati"}</button>
        </form>
        <p className="auth-switch">{mode === "login" ? "Non hai un account?" : "Hai già un account?"}<button type="button" disabled={!!loading} onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Registrati" : "Accedi"}</button></p>
        <div className="auth-theme"><ThemeToggle /></div>
        <nav className="legal-links" aria-label="Informazioni legali"><a href="/informazioni">Come funziona</a><a href="/privacy">Privacy</a><a href="/termini">Termini</a></nav>
      </section>
    </main>
  );
}
