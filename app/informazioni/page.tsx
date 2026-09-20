import type { Metadata } from "next";
import { SITE_URL } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Come funziona Studify",
  description: "Studify organizza i tuoi appunti e crea flashcard e quiz. Scopri cosa puoi fare e come vengono conservati i quaderni.",
  alternates: { canonical: `${SITE_URL}/informazioni` },
  robots: { index: true, follow: true },
};

export default function InformationPage() {
  const data = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Studify", applicationCategory: "EducationalApplication", operatingSystem: "Web", url: `${SITE_URL}/informazioni`, description: "Organizza appunti e crea flashcard e quiz per studiare." };
  return <main className="public-page">
    <header><a className="public-brand" href="/informazioni">Studify</a><a className="public-action" href="/login">Accedi</a></header>
    <article><h1>Studify, per studiare dai tuoi appunti</h1>
      <p>Incolla il testo di una lezione oppure carica un file. Studify organizza i contenuti in sezioni, prepara flashcard e ti permette di creare quiz da 5, 10 o 20 domande.</p>
      <h2>Come funziona</h2><p>Puoi correggere e copiare gli appunti, ripassare con le flashcard, provare un quiz e fare domande sul materiale che hai inviato. Verifica sempre le risposte dell’AI, soprattutto formule e dati importanti.</p>
      <h2>Dove sono salvati i quaderni?</h2><p>I quaderni e le cartelle sono salvati nel browser che usi, associati al tuo account. Non sono sincronizzati fra dispositivi e puoi perderli se cancelli i dati del browser. Il testo e i file che analizzi vengono inviati al servizio AI per produrre il materiale di studio.</p>
      <a className="public-action" href="/login">Apri Studify</a>
    </article>
    <footer><a href="/privacy">Privacy</a><a href="/termini">Termini</a></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  </main>;
}
