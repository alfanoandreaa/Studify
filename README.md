# Studify

Studify è una web app per studenti: organizza appunti in sezioni, genera flashcard e quiz e permette di fare domande sul materiale fornito. Il progetto usa Next.js, Vinext, React, Supabase Auth e un'API server per Google Gemini.

## Avvio

Richiede Node.js 22.13+ e pnpm. Esegui `pnpm install`, poi `pnpm dev`. Per verificare il progetto: `pnpm exec tsc --noEmit`, `pnpm lint` e `pnpm build`.

## Configurazione server

Le chiavi private si configurano solo nell'hosting, mai nel frontend o nel repository:

| Variabile | Scopo |
| --- | --- |
| `GEMINI_API_KEY` | Chiamate all'API AI dal server |
| `SUPABASE_SECRET_KEY` | Creazione ed eliminazione di utenti sul server |

La chiave Supabase `sb_publishable_...` nel client è pubblica per definizione. Il servizio AI richiede una sessione Supabase valida. Gli endpoint di registrazione e controllo account richiedono limiti globali a livello di hosting prima di un lancio pubblico su larga scala.

## Dati e limiti attuali

Supabase gestisce gli account. Appunti, cartelle, avatar e preferenze si trovano nel localStorage del browser, separati per ID utente. Non vengono sincronizzati tra dispositivi. La cancellazione dell'account elimina l'utente da Supabase e i dati locali nel browser in uso; non può cancellare copie in altri browser o esportazioni. L'app invia al provider AI il contenuto che l'utente sceglie di analizzare.

La registrazione conferma gli indirizzi email senza verificare che appartengano all'utente, perché non invia email. Non è disponibile il recupero automatico della password. Per un lancio pubblico è necessario decidere come verificare gli indirizzi e recuperare gli account.

## Pubblicazione

Il sito attuale è ospitato su ChatGPT Sites. Il repository GitHub è una copia del codice e non è il provider di deployment: l'hosting legge dal suo repository Sites. Dopo ogni modifica, sincronizza entrambi e verifica la versione pubblicata. Le pagine Privacy e Termini sono bozze segnalate come tali e non vanno presentate come definitive prima di ottenere i dati legali mancanti. Il dominio personalizzato richiede la scelta di un dominio posseduto dall'utente e la configurazione DNS.
