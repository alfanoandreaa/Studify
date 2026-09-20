# Studify

Studify trasforma appunti, immagini, PDF e file di testo in materiale di studio organizzato con riassunti, appunti corretti, concetti chiave, flashcard, quiz e chat basata sul materiale caricato.

## Dati

Quaderni, cartelle e foto profilo sono salvati nel `localStorage` del browser. Non vengono sincronizzati tra dispositivi e possono andare persi cancellando i dati del sito o cambiando browser/dispositivo.

## Variabili d'ambiente

Copia `.env.example` in un file env locale e configura:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_FALLBACK_MODEL`
- `GEMINI_LITE_MODEL`
- `GEMINI_LITE_FALLBACK_MODEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` solo lato server
- `APP_ORIGIN`, per esempio l'origine HTTPS pubblica senza path

I modelli Gemini hanno fallback nel codice con gli stessi nomi già usati dal progetto.

## Avvio

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Controlli prima del deploy:

```sh
pnpm lint
pnpm build
```

Per provare il Worker compilato:

```sh
pnpm start
```

## Rate limit D1

Il rate limit usa il binding Cloudflare D1 `DB`, dichiarato in `.openai/hosting.json`. Prima del deploy crea/collega un database D1 al binding `DB` e applica `db/rate-limit.sql`.

Il database è usato solo per i contatori di rate limit. I quaderni e le cartelle restano locali al browser.

## Deploy

Configura tutte le variabili d'ambiente nel provider, collega il binding D1 `DB`, applica lo schema del rate limit e pubblica il Worker con la pipeline Cloudflare/OpenAI Sites del progetto. `.openai/hosting.json` mantiene il `project_id` esistente.

Per la configurazione Supabase Auth e della conferma email vedi `AUTH-SETUP.md`.
