import type { Metadata } from "next";
export const metadata: Metadata = { title: "Informazioni sulla privacy", description: "Informazioni disponibili sul trattamento dei dati in Studify.", robots: { index: false, follow: false } };
export default function PrivacyPage() {
  return <main className="public-page"><header><a className="public-brand" href="/informazioni">Studify</a><a href="/login">Accedi</a></header><article>
    <h1>Privacy</h1><p className="public-notice">Questa pagina è ancora da completare con i dati del titolare del trattamento e non costituisce una informativa privacy definitiva.</p>
    <h2>Cosa sappiamo sul funzionamento</h2><p>Studify usa Supabase per gestire gli account e un servizio AI di Google per analizzare appunti, file e domande che invii. I quaderni, le cartelle, la foto profilo e la scelta del tema vengono conservati nel browser. I quaderni non sono sincronizzati fra dispositivi.</p>
    <h2>Prima del lancio</h2><p>Servono il nome e i recapiti del titolare del trattamento, le informazioni aggiornate su conservazione dei dati, fornitori, trasferimenti, basi giuridiche, diritti degli utenti e cookie o altri strumenti usati. Fai verificare l’informativa completa da un professionista prima di pubblicarla come definitiva.</p>
  </article><footer><a href="/informazioni">Come funziona</a><a href="/termini">Termini</a></footer></main>;
}
