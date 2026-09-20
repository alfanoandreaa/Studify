# Studify authentication

Studify usa Supabase Auth con email e password.

## Conferma email

La registrazione passa da `/api/auth/register`, che valida input, Origin e rate limit, poi usa `supabase.auth.signUp()`. L'utente deve confermare la proprietà dell'indirizzo email prima di poter accedere.

Il login non verifica più se un indirizzo esiste: credenziali errate restituiscono sempre il messaggio generico "Email o password errati". La registrazione può invece restituire `409` con "Questa email è già registrata.".

## Configurazione Supabase

Nel dashboard Supabase:

1. Vai in **Authentication → Providers → Email** e lascia abilitato l'accesso con email/password.
2. Attiva **Confirm Email**. Se è disattivato, Studify considera la registrazione non configurata correttamente.
3. Vai in **Authentication → URL Configuration**.
4. Imposta **Site URL** sulla stessa origine configurata in `APP_ORIGIN`.
5. Aggiungi tra i **Redirect URLs** `${APP_ORIGIN}/auth/callback`.
6. Verifica che il template **Confirm sign up** sia attivo e che il progetto possa inviare le email di autenticazione.
7. Configura nel deploy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`. La secret key deve restare esclusivamente lato server.

## Origin

Tutte le route sensibili usano lo stesso helper `sameOrigin`, che confronta l'header `Origin` con `APP_ORIGIN`.

## Rate limit

La registrazione e l'API Gemini usano Cloudflare D1 tramite il binding `DB`. Il rate limit non usa memoria del Worker.

Prima del deploy:

1. Crea o scegli un database Cloudflare D1.
2. Collega quel database al Worker con nome binding `DB`.
3. Applica `db/rate-limit.sql` al database.
4. Verifica che `.openai/hosting.json` continui a dichiarare `"d1": "DB"`.

Se il binding o la tabella non sono disponibili, le route protette falliscono in modo chiuso con un errore temporaneo invece di saltare il rate limit.

## Dati applicativi

Quaderni e cartelle non sono salvati in Supabase. Restano nel `localStorage` del browser, separati per ID utente. La rinomina delle chiavi da `quaderno-ai-*` a `studify-*` include una migrazione automatica una tantum per non perdere i dati esistenti.
