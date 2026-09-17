import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
const STUDY_MODEL = "gemini-3.7-flash";
const STUDY_FALLBACK_MODEL = "gemini-3.5-flash";
const LITE_MODEL = "gemini-3.1-flash-lite";
const LITE_FALLBACK_MODEL = "gemini-2.5-flash-lite";

type SourceTier = "short" | "medium" | "long";

function classifySource(text: unknown, fileData: unknown): SourceTier {
  const textLength = typeof text === "string" ? text.length : 0;
  const fileBytes = typeof fileData === "string" ? Math.ceil(fileData.length * 0.75) : 0;
  const estimatedSize = textLength + fileBytes;
  if (estimatedSize < 20_000) return "short";
  if (estimatedSize < 180_000) return "medium";
  return "long";
}

class AiUnavailableError extends Error {}

function endpointFor(model: string) {
  return "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
}

const quizItemSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
    correctIndex: { type: "integer" },
    explanation: { type: "string" }
  },
  required: ["question", "options", "correctIndex", "explanation"]
};

const studySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    subject: { type: "string" },
    noteSections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          blocks: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["point", "formula"] },
                content: { type: "string" }
              },
              required: ["kind", "content"]
            }
          }
        },
        required: ["title", "blocks"]
      }
    },
    summary: { type: "string" },
    keyConcepts: { type: "array", items: { type: "object", properties: { term: { type: "string" }, explanation: { type: "string" } }, required: ["term", "explanation"] } },
    flashcards: { type: "array", items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" } }, required: ["front", "back"] } },
    recommendedQuizCount: { type: "string", enum: ["5", "10", "20"] }
  },
  required: ["title", "subject", "noteSections", "summary", "keyConcepts", "flashcards", "recommendedQuizCount"]
};

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "La nostra AI non è ancora configurata." }, { status: 503 });
  try {
    const body = await request.json() as {
      mode?: unknown;
      quizCount?: unknown;
      message?: unknown;
      context?: unknown;
      text?: unknown;
      file?: { data?: unknown; mimeType?: unknown };
      draft?: unknown;
    };
    const isChat = body.mode === "chat";
    const isQuiz = body.mode === "quiz";
    const isVerify = body.mode === "verify";
    const requestedQuizCount = Number(body.quizCount);
    const quizCount = [5, 10, 20].includes(requestedQuizCount) ? requestedQuizCount : 5;
    const parts: Array<Record<string, unknown>> = [];
    if (isChat) {
      if (typeof body.message !== "string" || typeof body.context !== "string") return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
      parts.push({ text: "Sei un tutor paziente. Rispondi in italiano usando ESCLUSIVAMENTE gli appunti tra <appunti> e </appunti>. Se la risposta non è presente, dichiaralo. Non inventare informazioni. Sii chiaro e breve.\n\n<appunti>\n" + body.context.slice(0, 120000) + "\n</appunti>\n\nDomanda: " + body.message });
    } else if (isQuiz) {
      if (typeof body.context !== "string" || !body.context.trim()) return NextResponse.json({ error: "Appunti non disponibili." }, { status: 400 });
      parts.push({ text: `Crea in italiano esattamente ${quizCount} domande a scelta multipla usando ESCLUSIVAMENTE gli appunti tra <appunti> e </appunti>. Ogni domanda deve avere esattamente 4 opzioni, una sola corretta e una breve spiegazione. Distribuisci le domande su tutto il materiale, varia la difficoltà, evita ripetizioni e non aggiungere informazioni esterne. correctIndex deve essere un numero da 0 a 3.\n\n<appunti>\n${body.context.slice(0, 140000)}\n</appunti>` });
    } else if (isVerify) {
      if (!body.draft || typeof body.draft !== "object") return NextResponse.json({ error: "Bozza da verificare non disponibile." }, { status: 400 });
      parts.push({ text: `Agisci come revisore tecnico indipendente di appunti scolastici. La bozza può contenere errori plausibili ma gravi: non fidarti dei suoi calcoli o delle sue affermazioni.

Confronta punto per punto la fonte originale con la bozza. Restituisci l'intero materiale corretto nello stesso schema richiesto, non un elenco di commenti.

Controlli obbligatori:
- conserva ogni informazione utile della fonte, correggendola invece di ometterla;
- rifai da zero formule, sostituzioni numeriche, conversioni e unità di misura;
- distingui valori nominali, consigliati e massimi assoluti;
- se un calcolo dipende da un dato mancante, non assumere un valore tipico e non presentare un numero come certo: usa [Da verificare: dato mancante];
- nei circuiti con componenti non ohmici, considera le loro cadute di tensione o segnala che il dato manca;
- elimina generalizzazioni non universali e affermazioni dipendenti da datasheet non forniti;
- correggi grammatica, apostrofi e terminologia;
- nei blocchi formula inserisci soltanto l'espressione, senza la parola Formula e senza Markdown;
- esegui un ultimo confronto con la fonte prima di rispondere.

<bozza>
${JSON.stringify(body.draft).slice(0, 180000)}
</bozza>` });
      if (typeof body.text === "string" && body.text.trim()) parts.push({ text: `<fonte_testuale>\n${body.text.slice(0, 150000)}\n</fonte_testuale>` });
      if (body.file?.data && body.file?.mimeType) parts.push({ inlineData: { mimeType: body.file.mimeType, data: body.file.data } });
      if (parts.length === 1) return NextResponse.json({ error: "Fonte originale non disponibile per la verifica." }, { status: 400 });
    } else {
      parts.push({ text: `Analizza questi appunti scolastici e scrivi tutto in italiano. Il tuo compito non è soltanto riordinare il testo: devi anche correggerne il contenuto.

Prima di produrre la risposta, controlla attentamente ogni definizione, formula, calcolo, conversione, unità di misura e affermazione tecnica usando conoscenze scolastiche consolidate. Correggi direttamente le informazioni false, incomplete o imprecise invece di copiarle. Mantieni soltanto i contenuti pertinenti alla lezione e non aggiungere argomenti estranei. Se un'informazione dipende da un componente specifico, da un datasheet o dal contesto e non può essere verificata con sicurezza, non indovinare: scrivi [Da verificare: motivo]. Correggi anche refusi e termini usati impropriamente. Esegui nuovamente tutti i calcoli e controlla che risultati e unità siano coerenti.

Per noteSections crea appunti da quaderno facili da scansionare:
- dividi il contenuto in sezioni con titoli brevi;
- usa un blocco kind "point" per ogni singola nozione;
- usa un blocco kind "formula" contenente soltanto l'espressione, per esempio V = R × I;
- usa frasi brevi e non creare paragrafi lunghi;
- dopo una formula, spiega i simboli con blocchi point separati;
- separa chiaramente definizioni, formule, esempi e unità di misura;
- usa testo normale e simboli Unicode come Ω, Δ e ×. Non usare Markdown, LaTeX, delimitatori $, asterischi o HTML;
- ogni informazione utile della fonte deve comparire nel risultato: conservala se corretta, correggila se errata oppure indicala come [Da verificare: motivo] se dipende da dati mancanti;
- prima di produrre il JSON finale esegui, nello stesso passaggio, una revisione completa: confronta la fonte con noteSections, recupera eventuali informazioni omesse e ricontrolla da zero formule, risultati, conversioni e unità di misura. Restituisci soltanto il risultato già corretto e verificato.

Genera inoltre un titolo breve, la materia, un riassunto completo ma conciso, da 4 a 8 concetti chiave e da 6 a 12 flashcard. Non generare il quiz adesso. Indica recommendedQuizCount scegliendo 5 per materiale breve e focalizzato, 10 per materiale di media lunghezza o con diversi argomenti, 20 per materiale lungo, denso o diviso in molte sezioni.` });
      if (typeof body.text === "string" && body.text.trim()) parts.push({ text: body.text.slice(0, 150000) });
      if (body.file?.data && body.file?.mimeType) parts.push({ inlineData: { mimeType: body.file.mimeType, data: body.file.data } });
      if (parts.length === 1) return NextResponse.json({ error: "Non sono stati ricevuti appunti." }, { status: 400 });
    }
    const quizSchema = {
      type: "object",
      properties: { quiz: { type: "array", items: quizItemSchema, minItems: quizCount, maxItems: quizCount } },
      required: ["quiz"]
    };
    const sourceTier = classifySource(body.text, body.file?.data);
    const hasFile = typeof body.file?.data === "string" && body.file.data.length > 0;
    const useLiteStudyModel = !hasFile && sourceTier === "short";
    const studyMaxOutputTokens = sourceTier === "short" ? 5000 : sourceTier === "medium" ? 8500 : 13000;
    const studyThinkingLevel = sourceTier === "long" ? "MEDIUM" : "LOW";
    const generationConfig = isChat
      ? { temperature: 0.25, maxOutputTokens: 1800 }
      : isQuiz
        ? { temperature: 0.25, maxOutputTokens: 8000, responseMimeType: "application/json", responseSchema: quizSchema }
        : isVerify
          ? { temperature: 0.05, maxOutputTokens: 10000, thinkingConfig: { thinkingLevel: "MEDIUM" }, responseMimeType: "application/json", responseSchema: studySchema }
          : { temperature: 0.15, maxOutputTokens: studyMaxOutputTokens, thinkingConfig: { thinkingLevel: studyThinkingLevel }, responseMimeType: "application/json", responseSchema: studySchema };
    const primaryModel = isChat || isQuiz ? LITE_MODEL : useLiteStudyModel ? LITE_MODEL : STUDY_MODEL;
    const fallbackModel = isChat || isQuiz || useLiteStudyModel ? LITE_FALLBACK_MODEL : STUDY_FALLBACK_MODEL;
    const modelAttempts = [primaryModel, primaryModel, fallbackModel];
    const requestBody = JSON.stringify({ contents: [{ role: "user", parts }], generationConfig });
    let output = "";
    let lastError = "La nostra AI non ha completato la richiesta.";
    for (let attemptIndex = 0; attemptIndex < modelAttempts.length; attemptIndex++) {
      const selectedModel = modelAttempts[attemptIndex];
      try {
        const geminiResponse = await fetch(endpointFor(selectedModel), {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: requestBody
        });

        const result = await geminiResponse.json() as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        if (geminiResponse.ok) {
          output = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
          if (output) break;
          lastError = "La risposta ricevuta era vuota.";
        } else {
          lastError = result.error?.message || lastError;
          console.warn("AI model rejected request", { model: selectedModel, status: geminiResponse.status, reason: lastError.slice(0, 300) });
          const canRetry = [408, 429, 500, 502, 503, 504, 529].includes(geminiResponse.status)
            || /high demand|overloaded|temporarily unavailable|deadline|timeout|resource exhausted/i.test(lastError);
          if (geminiResponse.status === 404 && attemptIndex < 2) {
            attemptIndex = 1;
            continue;
          }
          if (!canRetry) throw new Error(lastError);
        }
      } catch (error) {
        if (error instanceof Error && !/fetch|network|timeout|deadline/i.test(error.message)) throw error;
        lastError = error instanceof Error ? error.message : lastError;
        console.warn("AI model request failed", { model: selectedModel, reason: lastError.slice(0, 300) });
      }

      if (attemptIndex < modelAttempts.length - 1) {
        const pauseMs = attemptIndex === 0 ? 250 : 450;
        await new Promise((resolve) => setTimeout(resolve, pauseMs + Math.floor(Math.random() * 100)));
      }
    }

    if (!output) throw new AiUnavailableError("L’analisi non è riuscita dopo più tentativi. Riprova.");
    if (isChat) return NextResponse.json({ answer: output });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (isQuiz) return NextResponse.json(parsed);
    const sections = Array.isArray(parsed.noteSections) ? parsed.noteSections as Array<{ title?: unknown; blocks?: unknown }> : [];
    const correctedNotes = sections.map((section) => {
      const title = typeof section.title === "string" ? section.title.trim() : "";
      const blocks = Array.isArray(section.blocks) ? section.blocks as Array<{ kind?: unknown; content?: unknown }> : [];
      const lines = blocks.flatMap((block) => {
        if (typeof block.content !== "string" || !block.content.trim()) return [];
        const content = block.content.trim().replace(/^\**formula\**\s*:?\s*/i, "");
        return [block.kind === "formula" ? `FORMULA: ${content}` : `- ${content}`];
      });
      return [`## ${title}`, ...lines].join("\n");
    }).join("\n\n");
    return NextResponse.json({ ...parsed, correctedNotes });
  } catch (error) {
    const status = error instanceof AiUnavailableError ? 503 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Errore durante l’analisi." }, { status });
  }
}
