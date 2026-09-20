import type { Metadata } from "next";
export const metadata: Metadata = { title: "Informazioni sui termini", description: "Informazioni disponibili sulle condizioni di utilizzo di Studify.", robots: { index: false, follow: false } };
export default function TermsPage() {
  return <main className="public-page"><header><a className="public-brand" href="/informazioni">Studify</a><a href="/login">Accedi</a></header><article>
    <h1>Termini di utilizzo</h1><p className="public-notice">Questi termini sono ancora da completare. Non sostituiscono condizioni di utilizzo definite e verificate prima del lancio.</p>
    <h2>Uso dell’app</h2><p>Studify aiuta a studiare dai propri appunti. I risultati automatici possono contenere errori: controlla i contenuti prima di usarli per studio o verifiche. I quaderni sono salvati nel browser; se cancelli i dati del browser puoi perderli.</p>
    <h2>Prima del lancio</h2><p>Servono l’identità del gestore, un recapito, le condizioni del servizio e le regole su disponibilità, responsabilità, proprietà dei contenuti e chiusura dell’account. Eventuali prezzi o abbonamenti devono essere descritti solo se realmente attivi.</p>
  </article><footer><a href="/informazioni">Come funziona</a><a href="/privacy">Privacy</a></footer></main>;
}
