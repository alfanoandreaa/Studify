"use client";
/* Profile images are tiny browser-local data URLs, not CDN assets. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookOpen, Check, ChevronRight,
  Copy, FileText, Folder, FolderPlus, GraduationCap, Layers3, Menu,
  LogOut, MessageCircle, MoreHorizontal, Pencil, Plus, RotateCcw, Send, Settings2, PanelLeftClose, PanelLeftOpen, Sparkles,
  Trash2, UploadCloud, X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/app/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/app/components/theme-toggle";

type StudyPack = {
  id: string; title: string; subject: string; createdAt: string; sourceName: string;
  folderId?: string;
  correctedNotes: string; summary: string;
  noteSections?: { title: string; blocks: { kind: "point" | "formula"; content: string }[] }[];
  keyConcepts: { term: string; explanation: string }[];
  flashcards: { front: string; back: string }[];
  recommendedQuizCount?: QuizSize;
  quiz: { question: string; options: string[]; correctIndex: number; explanation: string }[];
};
type StudyFolder = { id: string; name: string };
type ChatMessage = { role: "user" | "assistant"; text: string };
const STORAGE_KEY = "quaderno-ai-packs-v1";
const FOLDERS_KEY = "quaderno-ai-folders-v1";
const AVATAR_KEY = "studify-avatar-v1";
const SIDEBAR_KEY = "studify-sidebar-collapsed";
type QuizSize = 5 | 10 | 20;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"]);
const LOADING_PHRASES = ["Leggo gli appunti", "Controllo le formule", "Riordino i concetti", "Creo le flashcard", "Ultimo controllo"];

function isAcceptedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_FILE_TYPES.has(file.type) || ["jpg", "jpeg", "png", "webp", "pdf", "txt"].includes(extension || "");
}

async function readApiResponse(response: Response) {
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { data = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch {}
  if (!response.ok) {
    const fallback = response.status === 429 ? "Troppe richieste. Attendi qualche secondo e riprova."
      : response.status === 413 ? "Il file è troppo grande."
      : response.status >= 500 ? "Il servizio AI è momentaneamente non disponibile. Riprova tra poco."
      : "La richiesta non è riuscita.";
    throw new Error(typeof data.error === "string" ? data.error : fallback);
  }
  return data;
}

async function fetchAi(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessione scaduta. Accedi di nuovo.");
  return fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body)
  });
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(value));
}

function notesForClipboard(pack: StudyPack) {
  if (pack.noteSections?.length) {
    return pack.noteSections.map((section) => [
      section.title,
      ...section.blocks.map((block) => block.kind === "formula"
        ? `Formula: ${block.content.replace(/^\**formula\**\s*:?\s*/i, "")}`
        : `• ${block.content}`)
    ].join("\n")).join("\n\n");
  }

  return pack.correctedNotes
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^FORMULA\s*:?\s*/gim, "Formula: ");
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function prepareAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 5 * 1024 * 1024) {
      reject(new Error("Scegli un'immagine JPG, PNG o WEBP di massimo 5 MB.")); return;
    }
    const reader = new FileReader();
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Impossibile preparare l'immagine.");
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        context.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) { reject(error); }
    };
    img.onerror = () => reject(new Error("Immagine non leggibile."));
    reader.onload = () => { img.src = String(reader.result || ""); };
    reader.onerror = () => reject(new Error("Impossibile leggere l'immagine."));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const router = useRouter();
  const [packs, setPacks] = useState<StudyPack[]>([]);
  const [folders, setFolders] = useState<StudyFolder[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderToRename, setFolderToRename] = useState<StudyFolder | null>(null);
  const [renamedFolderName, setRenamedFolderName] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<StudyFolder | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const accountDeletionBusy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const activePack = useMemo(() => packs.find((pack) => pack.id === activeId) || null, [packs, activeId]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (!data.session) return router.replace("/login");
      const { data: verified, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!verified.user) {
        if (error && error.status !== 401 && error.status !== 403 && error.code !== "user_not_found" && error.code !== "session_not_found") { toast.error("Servizio di accesso temporaneamente non disponibile. Riprova tra poco."); router.replace("/login"); return; }
        localStorage.removeItem(`${STORAGE_KEY}:${data.session.user.id}`);
        localStorage.removeItem(`${FOLDERS_KEY}:${data.session.user.id}`);
        await supabase.auth.signOut({ scope: "local" });
        router.replace("/login"); return;
      }
      setUserId(data.session.user.id);
      setUserEmail(data.session.user.email || "Studente");
      setAuthReady(true);
    }).catch(() => { if (mounted) { toast.error("Connessione non riuscita. Riprova ad accedere."); router.replace("/login"); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setAuthReady(false); router.replace("/login"); }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [router]);

  useEffect(() => {
    try { const saved = localStorage.getItem(SIDEBAR_KEY) === "true"; queueMicrotask(() => setSidebarCollapsed(saved)); } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    let savedAvatar: string | null = null;
    try { savedAvatar = localStorage.getItem(`${AVATAR_KEY}:${userId}`); } catch {}
    const userPacksKey = `${STORAGE_KEY}:${userId}`;
    const userFoldersKey = `${FOLDERS_KEY}:${userId}`;
    try {
      const savedPacks = localStorage.getItem(userPacksKey);
      const savedFolders = localStorage.getItem(userFoldersKey);
      // Unowned legacy data must never be imported into a different/new account.
      const stored = JSON.parse(savedPacks || "[]");
      const storedFolders = JSON.parse(savedFolders || "[]");
      queueMicrotask(() => { setAvatar(savedAvatar); setPacks(Array.isArray(stored) ? stored : []); setFolders(Array.isArray(storedFolders) ? storedFolders : []); setStorageReady(true); });
    } catch { localStorage.removeItem(userPacksKey); localStorage.removeItem(userFoldersKey); queueMicrotask(() => { setPacks([]); setFolders([]); setStorageReady(true); }); }
  }, [userId]);

  useEffect(() => {
    if (!storageReady) return;
    if (!userId) return;
    try { localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(packs)); }
    catch { toast.error("Lo spazio del browser è pieno. Elimina un vecchio quaderno e riprova."); }
  }, [packs, storageReady, userId]);

  useEffect(() => {
    if (!storageReady) return;
    if (!userId) return;
    try { localStorage.setItem(`${FOLDERS_KEY}:${userId}`, JSON.stringify(folders)); }
    catch { toast.error("Non è stato possibile salvare le cartelle."); }
  }, [folders, storageReady, userId]);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setLoadingPhrase((current) => (current + 1) % LOADING_PHRASES.length), 1800);
    return () => window.clearInterval(timer);
  }, [loading]);

  function newNotebook() {
    setActiveId(null); setNotes(""); setFile(null); setMobileMenu(false);
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  }

  async function chooseAvatar(file: File | undefined) {
    if (!file || !userId) return;
    try {
      const image = await prepareAvatar(file);
      localStorage.setItem(`${AVATAR_KEY}:${userId}`, image);
      setAvatar(image);
      toast.success("Foto profilo aggiornata.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Impossibile salvare la foto."); }
    finally { if (avatarInput.current) avatarInput.current.value = ""; }
  }

  function removeAvatar() {
    try { localStorage.removeItem(`${AVATAR_KEY}:${userId}`); } catch {}
    setAvatar(null);
    toast.success("Foto profilo rimossa.");
  }

  function selectFile(nextFile: File | null) {
    if (!nextFile) return setFile(null);
    if (notes.trim()) return toast.error("Puoi usare un file oppure il testo, non entrambi.");
    if (nextFile.size > MAX_FILE_SIZE) return toast.error("Il file supera il limite di 8 MB.");
    if (!isAcceptedFile(nextFile)) return toast.error("Formato non supportato. Usa JPG, PNG, WEBP, PDF o TXT.");
    setFile(nextFile);
  }

  async function analyze(inputOverride?: string) {
    const inputText = inputOverride || notes;
    if (!inputText.trim() && !file) return toast.error("Aggiungi del testo o carica un file.");
    if (inputText.trim() && file) return toast.error("Scegli soltanto un file oppure il testo.");
    if (file && file.size > MAX_FILE_SIZE) return toast.error("Il file supera il limite di 8 MB.");
    setLoadingPhrase(0);
    setLoading(true);
    try {
      const encodedFile = file ? { name: file.name, mimeType: file.type || "application/octet-stream", data: await fileToBase64(file) } : undefined;
      const response = await fetchAi({ mode: "analyze", text: inputText, file: encodedFile });
      const data = await readApiResponse(response);
      if (typeof data.title !== "string" || typeof data.subject !== "string" || typeof data.correctedNotes !== "string" || typeof data.summary !== "string" || !Array.isArray(data.keyConcepts) || !Array.isArray(data.flashcards)) {
        throw new Error("L’AI ha restituito un risultato incompleto. Riprova.");
      }
      const pack: StudyPack = { ...(data as unknown as Omit<StudyPack, "id" | "createdAt" | "sourceName" | "quiz">), quiz: [], id: crypto.randomUUID(), createdAt: new Date().toISOString(), sourceName: file?.name || "Testo incollato" };
      setPacks((current) => [pack, ...current]);
      setActiveId(pack.id); setNotes(""); setFile(null);
      toast.success("Il quaderno è pronto.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Qualcosa è andato storto.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "stage_study_notes",
        title: "Prepara appunti da studiare",
        description: "Inserisce appunti testuali nel campo di creazione del quaderno.",
        inputSchema: { type: "object", properties: { notes: { type: "string", minLength: 20 } }, required: ["notes"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: unknown) => {
          const value = input as { notes?: unknown };
          if (typeof value.notes !== "string" || value.notes.trim().length < 20) throw new Error("Servono almeno 20 caratteri.");
          newNotebook(); setNotes(value.notes);
          return { staged: true, characters: value.notes.length };
        }
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {}
    return () => lifecycle.abort();
  }, []);

  function removePack(id: string) {
    setPacks((current) => current.filter((pack) => pack.id !== id));
    setActiveId(null); toast.success("Quaderno eliminato.");
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return toast.error("Inserisci il nome della materia.");
    if (folders.some((folder) => folder.name.toLocaleLowerCase("it") === name.toLocaleLowerCase("it"))) return toast.error("Esiste già una cartella con questo nome.");
    setFolders((current) => [...current, { id: crypto.randomUUID(), name }]);
    setNewFolderName(""); setFolderDialogOpen(false);
    toast.success("Cartella creata.");
  }

  function renameFolder() {
    const name = renamedFolderName.trim();
    if (!folderToRename || !name) return toast.error("Inserisci il nome della materia.");
    if (folders.some((folder) => folder.id !== folderToRename.id && folder.name.toLocaleLowerCase("it") === name.toLocaleLowerCase("it"))) return toast.error("Esiste già una cartella con questo nome.");
    setFolders((current) => current.map((folder) => folder.id === folderToRename.id ? { ...folder, name } : folder));
    setFolderToRename(null); setRenamedFolderName("");
    toast.success("Cartella rinominata.");
  }

  function deleteFolder() {
    if (!folderToDelete) return;
    const folderId = folderToDelete.id;
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setPacks((current) => current.map((pack) => pack.folderId === folderId ? { ...pack, folderId: undefined } : pack));
    setFolderToDelete(null);
    toast.success("Cartella eliminata. Gli appunti sono in Senza cartella.");
  }

  function updatePack(id: string, changes: Partial<StudyPack>) {
    setPacks((current) => current.map((pack) => pack.id === id ? { ...pack, ...changes } : pack));
  }

  async function signOut() {
    setStorageReady(false);
    await supabase.auth.signOut();
    setPacks([]); setFolders([]); setActiveId(null); setAvatar(null); setSettingsOpen(false);
    router.replace("/login");
  }

  async function deleteOwnAccount() {
    if (deleteConfirmation !== "ELIMINA" || accountDeletionBusy.current) return;
    accountDeletionBusy.current = true;
    setDeletingAccount(true); setDeleteAccountError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId) throw new Error("Sessione scaduta. Accedi di nuovo.");
      const response = await fetch("/api/account", {
        method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || result?.deleted !== true) throw new Error(typeof result?.error === "string" ? result.error : "Eliminazione non riuscita.");
      setStorageReady(false);
      let cleared = true;
      try {
        localStorage.removeItem(`${STORAGE_KEY}:${userId}`);
        localStorage.removeItem(`${FOLDERS_KEY}:${userId}`);
        localStorage.removeItem(`${AVATAR_KEY}:${userId}`);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(FOLDERS_KEY);
      } catch { cleared = false; }
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      setPacks([]); setFolders([]); setActiveId(null); setAvatar(null); setAuthReady(false);
      const next = new URL("/login", window.location.origin);
      next.searchParams.set("deleted", cleared ? "success" : "local-cleanup-needed");
      window.location.replace(next.pathname + next.search);
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : "Eliminazione non riuscita. Riprova.");
    } finally { accountDeletionBusy.current = false; setDeletingAccount(false); }
  }

  if (!authReady || !storageReady) return <main className="auth-page"><section className="auth-callback"><span className="spinner auth-page-spinner" /><p>Caricamento di Studify…</p></section></main>;

  const unfiledPacks = packs.filter((pack) => !pack.folderId || !folders.some((folder) => folder.id === pack.folderId));

  function notebookLink(pack: StudyPack) {
    return <button key={pack.id} className={"notebook-link " + (activeId === pack.id ? "active" : "")} onClick={() => { setActiveId(pack.id); setMobileMenu(false); }}>
      <span className="subject-dot" /><span className="notebook-copy"><b>{pack.title}</b><small>{pack.subject} · {dateLabel(pack.createdAt)}</small></span><ChevronRight />
    </button>;
  }

  return (
    <div className={"app-shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <Toaster position="top-center" richColors />
      <aside className={"sidebar " + (mobileMenu ? "sidebar-open" : "")}>
        <div className="brand-row">
          <button className="brand" onClick={newNotebook} aria-label="Pagina iniziale">
            <span className="brand-mark"><BookOpen /></span><span><b>Studify</b></span>
          </button>
          <Button className="desktop-sidebar-toggle" variant="ghost" size="icon-sm" onClick={toggleSidebar} aria-label={sidebarCollapsed ? "Espandi barra laterale" : "Riduci barra laterale"} title={sidebarCollapsed ? "Espandi barra laterale" : "Riduci barra laterale"} aria-expanded={!sidebarCollapsed}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</Button>
          <Button className="mobile-close" variant="ghost" size="icon" onClick={() => setMobileMenu(false)} aria-label="Chiudi menu"><X /></Button>
        </div>
        <Button className="new-note" onClick={newNotebook} aria-label="Nuovi appunti" title={sidebarCollapsed ? "Nuovi appunti" : undefined}><Plus /><span>Nuovi appunti</span></Button>
        <button className="collapsed-folders" onClick={toggleSidebar} aria-label="Mostra cartelle e appunti" title="Mostra cartelle e appunti"><Folder /></button>
        <div className="sidebar-section">
          <div className="sidebar-section-heading">
            <p className="eyebrow">Cartelle</p>
            <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
              <DialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Crea cartella"><FolderPlus /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuova cartella</DialogTitle><DialogDescription>Crea una cartella per una materia. Non sono previste sottocartelle.</DialogDescription></DialogHeader>
                <label className="dialog-field"><span>Nome della materia</span><Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createFolder(); }} placeholder="Es. Elettrotecnica" autoFocus /></label>
                <DialogFooter><Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Annulla</Button><Button onClick={createFolder}>Crea cartella</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="notebook-list">
            {folders.map((folder) => {
              const folderPacks = packs.filter((pack) => pack.folderId === folder.id);
              return <section className="folder-group" key={folder.id}>
                <div className="folder-label">
                  <Folder /><b>{folder.name}</b>
                  <div className="folder-actions">
                    <small>{folderPacks.length}</small>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Azioni cartella ${folder.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => { setFolderToRename(folder); setRenamedFolderName(folder.name); }}><Pencil /> Rinomina</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setFolderToDelete(folder)}><Trash2 /> Elimina</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="folder-notebooks">{folderPacks.length ? folderPacks.map(notebookLink) : <p className="folder-empty">Cartella vuota</p>}</div>
              </section>;
            })}
            {!!unfiledPacks.length && <section className="folder-group"><div className="folder-label"><BookOpen /><b>Senza cartella</b><small>{unfiledPacks.length}</small></div><div className="folder-notebooks">{unfiledPacks.map(notebookLink)}</div></section>}
            {packs.length === 0 && folders.length === 0 && <p className="sidebar-empty">Crea una cartella per materia oppure aggiungi nuovi appunti.</p>}
          </div>
        </div>
        <Dialog open={!!folderToRename} onOpenChange={(open) => { if (!open) { setFolderToRename(null); setRenamedFolderName(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rinomina cartella</DialogTitle><DialogDescription>Scegli un nuovo nome per questa materia.</DialogDescription></DialogHeader>
            <label className="dialog-field"><span>Nome della materia</span><Input value={renamedFolderName} onChange={(event) => setRenamedFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") renameFolder(); }} autoFocus /></label>
            <DialogFooter><Button variant="outline" onClick={() => { setFolderToRename(null); setRenamedFolderName(""); }}>Annulla</Button><Button onClick={renameFolder}>Salva</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <AlertDialog open={!!folderToDelete} onOpenChange={(open) => { if (!open) setFolderToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Eliminare la cartella “{folderToDelete?.name}”?</AlertDialogTitle><AlertDialogDescription>Gli appunti contenuti non verranno eliminati: saranno spostati in “Senza cartella”.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={deleteFolder}>Elimina cartella</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="sidebar-footer">
          <Button className="settings-open" variant="ghost" onClick={() => { setMobileMenu(false); setSettingsOpen(true); }} aria-label="Impostazioni" title={sidebarCollapsed ? "Impostazioni" : undefined}><Settings2 /><span>Impostazioni</span></Button>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="settings-dialog">
              <DialogHeader><DialogTitle>Impostazioni</DialogTitle><DialogDescription>Personalizza Studify e gestisci il tuo account.</DialogDescription></DialogHeader>
              <div className="settings-content">
                <section className="settings-group"><h3>Aspetto</h3><ThemeToggle /></section>
                <section className="settings-group"><h3>Foto profilo</h3>
                  <div className="settings-avatar-row"><span className="avatar-preview">{avatar ? <img src={avatar} alt="Foto profilo" /> : userEmail.charAt(0).toUpperCase()}</span><div><b>{userEmail}</b><small>La foto è salvata in questo browser, solo per questo account.</small></div></div>
                  <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void chooseAvatar(event.target.files?.[0])} />
                  <div className="settings-actions"><Button variant="outline" onClick={() => avatarInput.current?.click()}>Scegli immagine</Button><Button variant="ghost" onClick={removeAvatar} disabled={!avatar}>Rimuovi immagine</Button></div>
                </section>
                <section className="settings-group"><h3>Account</h3><Button variant="outline" onClick={() => void signOut()}><LogOut />Esci dall’account</Button><Button variant="destructive" onClick={() => { setSettingsOpen(false); setDeleteConfirmation(""); setDeleteAccountError(""); setDeleteAccountOpen(true); }}><Trash2 />Elimina account</Button></section>
              </div>
            </DialogContent>
          </Dialog>
          <AlertDialog open={deleteAccountOpen} onOpenChange={(open) => { if (!deletingAccount) setDeleteAccountOpen(open); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare definitivamente il tuo account?</AlertDialogTitle>
                <AlertDialogDescription>L’account {userEmail} verrà eliminato da Studify e le sessioni verranno revocate. Gli appunti e le cartelle di questo account salvati in questo browser saranno rimossi. Le copie su altri dispositivi e i file esportati non possono essere cancellati da qui. L’operazione non è annullabile. Prima salva ciò che vuoi conservare.</AlertDialogDescription>
              </AlertDialogHeader>
              <label className="dialog-field"><span>Scrivi ELIMINA per confermare</span><Input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} disabled={deletingAccount} autoComplete="off" /></label>
              {deleteAccountError && <p className="auth-message error" role="alert">{deleteAccountError}</p>}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingAccount}>Annulla</AlertDialogCancel>
                <Button variant="destructive" disabled={deletingAccount || deleteConfirmation !== "ELIMINA"} onClick={() => void deleteOwnAccount()}>{deletingAccount ? "Eliminazione…" : "Elimina definitivamente"}</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="profile-chip"><span className="profile-avatar">{avatar ? <img src={avatar} alt="" /> : userEmail.charAt(0).toUpperCase()}</span><div><b>Il mio spazio</b><small>{userEmail}</small></div></div>
          <nav className="legal-links" aria-label="Informazioni legali"><a href="/informazioni">Info</a><a href="/privacy">Privacy</a><a href="/termini">Termini</a></nav>
        </div>
      </aside>
      {mobileMenu && <button className="sidebar-scrim" onClick={() => setMobileMenu(false)} aria-label="Chiudi menu" />}

      <main className="main-area">
        <div className="mobile-toolbar">
          <Button className="menu-button" variant="ghost" size="icon" onClick={() => setMobileMenu(true)} aria-label="Apri menu"><Menu /></Button>
          <b>{activePack?.title || "Studify"}</b>
        </div>

        {activePack ? <StudyWorkspace key={activePack.id} pack={activePack} folders={folders} onBack={newNotebook} onDelete={() => removePack(activePack.id)} onUpdate={(changes) => updatePack(activePack.id, changes)} /> : (
          <section className="home-content">
            <div className="welcome-copy">
              <Badge variant="secondary"><Sparkles /> Preparazione intelligente</Badge>
              <h1>I tuoi appunti,<br /><span>pronti da studiare.</span></h1>
              <p>Carica ciò che hai scritto. Otterrai un riassunto chiaro, flashcard e un quiz costruiti sul tuo materiale.</p>
            </div>
            <div className="composer-card">
              <div className="input-grid">
                <div className={"drop-zone " + (dragging ? "dragging " : "") + (loading || !!notes.trim() ? "disabled" : "")}
                  onDragOver={(e) => { e.preventDefault(); if (!loading && !notes.trim()) setDragging(true); }} onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); if (!loading && !notes.trim() && e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]); }}>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" hidden disabled={loading || !!notes.trim()} onChange={(e) => selectFile(e.target.files?.[0] || null)} />
                  <div className="upload-icon"><UploadCloud /></div>
                  {file ? <div className="selected-file"><FileText /><div><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></div><Button variant="ghost" size="icon-sm" disabled={loading} onClick={() => setFile(null)} aria-label="Rimuovi file"><X /></Button></div> :
                    <><h2>Carica un file</h2><p>Trascina qui foto, PDF o TXT</p><Button variant="outline" disabled={loading || !!notes.trim()} onClick={() => fileInput.current?.click()}><UploadCloud /> Scegli file</Button><small>{notes.trim() ? "Cancella il testo per usare un file" : "JPG, PNG, WEBP, PDF o TXT · massimo 8 MB"}</small></>}
                </div>
                <div className="input-separator"><span>oppure</span></div>
                <div className={"paste-zone " + (file ? "disabled" : "")}>
                  <div className="paste-heading"><FileText /><div><h2>Incolla il testo</h2><p>Scrivi o incolla gli appunti</p></div></div>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={file ? "Rimuovi il file per inserire il testo" : "Incolla qui gli appunti della lezione…"} className="notes-input" disabled={loading || !!file} />
                </div>
              </div>
              <div className="composer-footer">
                <Button size="lg" onClick={() => void analyze()} disabled={loading || (!notes.trim() && !file)}>
                  {loading ? <><span className="spinner" /> <span className="loading-copy" key={loadingPhrase}>{LOADING_PHRASES[loadingPhrase]}…</span></> : <><Sparkles /> Crea materiale di studio</>}
                </Button>
              </div>
            </div>
            <div className="feature-strip">
              <div><span><FileText /></span><div><b>Riassunto chiaro</b><small>I concetti essenziali</small></div></div>
              <div><span><Layers3 /></span><div><b>Flashcard immediate</b><small>Per ricordare meglio</small></div></div>
              <div><span><GraduationCap /></span><div><b>Quiz personalizzato</b><small>Soltanto dai tuoi appunti</small></div></div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StudyWorkspace({ pack, folders, onBack, onDelete, onUpdate }: { pack: StudyPack; folders: StudyFolder[]; onBack: () => void; onDelete: () => void; onUpdate: (changes: Partial<StudyPack>) => void }) {
  const [flipped, setFlipped] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([{ role: "assistant", text: "Chiedimi qualcosa. Risponderò usando soltanto questi appunti." }]);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const fallbackRecommendation: QuizSize = pack.correctedNotes.length > 9000 ? 20 : pack.correctedNotes.length > 3000 ? 10 : 5;
  const recommendedValue = Number(pack.recommendedQuizCount);
  const recommendedQuiz: QuizSize = [5, 10, 20].includes(recommendedValue) ? recommendedValue as QuizSize : fallbackRecommendation;
  const existingQuizSize = [5, 10, 20].includes(pack.quiz.length) ? pack.quiz.length as QuizSize : recommendedQuiz;
  const [quizCount, setQuizCount] = useState<QuizSize>(existingQuizSize);
  const [quizLoading, setQuizLoading] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(pack.title);
  const [draftFolder, setDraftFolder] = useState(pack.folderId || "none");
  const [notesCopied, setNotesCopied] = useState(false);
  const score = pack.quiz.reduce((total, item, index) => total + (answers[index] === item.correctIndex ? 1 : 0), 0);
  const progress = submitted && pack.quiz.length ? Math.round(score / pack.quiz.length * 100) : 0;
  const currentFolder = folders.find((folder) => folder.id === pack.folderId);

  function saveOrganization() {
    const title = draftTitle.trim();
    if (!title) return toast.error("Il nome degli appunti non può essere vuoto.");
    onUpdate({ title, folderId: draftFolder === "none" ? undefined : draftFolder });
    setOrganizeOpen(false); toast.success("Appunti aggiornati.");
  }

  async function copyCorrectedNotes() {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard non disponibile");
      await navigator.clipboard.writeText(notesForClipboard(pack));
      setNotesCopied(true);
      toast.success("Appunti copiati.");
      window.setTimeout(() => setNotesCopied(false), 1800);
    } catch {
      toast.error("Non è stato possibile copiare gli appunti.");
    }
  }

  async function sendQuestion() {
    if (!question.trim() || chatLoading) return;
    const message = question.trim(); setQuestion(""); setChat((c) => [...c, { role: "user", text: message }]); setChatLoading(true);
    try {
      const response = await fetchAi({ mode: "chat", message, context: pack.correctedNotes + "\n\n" + pack.summary });
      const data = await readApiResponse(response);
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("L’AI non ha restituito una risposta. Riprova.");
      setChat((c) => [...c, { role: "assistant", text: data.answer as string }]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Risposta non disponibile."); }
    finally { setChatLoading(false); }
  }

  async function generateQuiz() {
    if (quizLoading) return;
    setQuizLoading(true);
    try {
      const response = await fetchAi({ mode: "quiz", quizCount, context: pack.correctedNotes + "\n\n" + pack.summary });
      const data = await readApiResponse(response);
      if (!Array.isArray(data.quiz) || data.quiz.length !== quizCount) throw new Error("Il quiz ricevuto è incompleto. Riprova.");
      onUpdate({ quiz: data.quiz as StudyPack["quiz"] });
      setAnswers({}); setSubmitted(false);
      toast.success(`Quiz da ${quizCount} domande pronto.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Quiz non disponibile.");
    } finally { setQuizLoading(false); }
  }

  return (
    <section className="workspace-content">
      <div className="workspace-heading">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Torna alla pagina iniziale"><ArrowLeft /></Button>
        <div><Badge variant="secondary">{pack.subject}</Badge><h1>{pack.title}</h1><p>{currentFolder ? currentFolder.name + " · " : ""}{pack.sourceName} · {dateLabel(pack.createdAt)}</p></div>
        <div className="workspace-actions">
        <Dialog open={organizeOpen} onOpenChange={(open) => { setOrganizeOpen(open); if (open) { setDraftTitle(pack.title); setDraftFolder(pack.folderId || "none"); } }}>
          <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil /> Organizza</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Organizza gli appunti</DialogTitle><DialogDescription>Rinomina il quaderno e scegli la cartella della materia.</DialogDescription></DialogHeader>
            <div className="organize-fields">
              <label className="dialog-field"><span>Nome degli appunti</span><Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></label>
              <label className="dialog-field"><span>Cartella</span><Select value={draftFolder} onValueChange={setDraftFolder}><SelectTrigger className="folder-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Senza cartella</SelectItem>{folders.map((folder) => <SelectItem value={folder.id} key={folder.id}><Folder /> {folder.name}</SelectItem>)}</SelectContent></Select></label>
              <small>Le cartelle sono tutte allo stesso livello e non possono contenere altre cartelle.</small>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOrganizeOpen(false)}>Annulla</Button><Button onClick={saveOrganization}>Salva</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="delete-button" aria-label="Elimina quaderno"><Trash2 /></Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Eliminare questi appunti?</AlertDialogTitle><AlertDialogDescription>Il quaderno, le flashcard e il quiz verranno eliminati definitivamente.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onDelete}>Elimina</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
      <Tabs defaultValue="summary" className="study-tabs">
        <div className="tabs-scroll"><TabsList variant="line">
          <TabsTrigger value="summary"><Sparkles /> Riassunto</TabsTrigger><TabsTrigger value="notes"><FileText /> Appunti</TabsTrigger>
          <TabsTrigger value="flashcards"><Layers3 /> Flashcard</TabsTrigger><TabsTrigger value="quiz"><GraduationCap /> Quiz</TabsTrigger>
          <TabsTrigger value="chat"><MessageCircle /> Chiedi all’AI</TabsTrigger>
        </TabsList></div>
        <TabsContent value="summary" className="study-panel">
          <PanelTitle icon={<Sparkles />} tone="teal" title="Riassunto essenziale" subtitle="Una versione chiara e ordinata dei tuoi appunti." />
          <div className="prose-notes">{pack.summary}</div>
          {!!pack.keyConcepts.length && <><div className="section-rule" /><h3>Concetti chiave</h3><div className="concept-grid">{pack.keyConcepts.map((item) => <article key={item.term}><b>{item.term}</b><p>{item.explanation}</p></article>)}</div></>}
        </TabsContent>
        <TabsContent value="notes" className="study-panel">
          <div className="panel-heading-row">
            <PanelTitle icon={<FileText />} tone="blue" title="Appunti corretti e riordinati" subtitle="Errori, formule e calcoli vengono controllati prima di organizzare il testo." />
            <Button variant="outline" size="sm" onClick={() => void copyCorrectedNotes()} aria-label="Copia gli appunti corretti">
              {notesCopied ? <><Check /> Copiati</> : <><Copy /> Copia</>}
            </Button>
          </div>
          {pack.noteSections?.length ? <StructuredNotes sections={pack.noteSections} /> : <FormattedNotes text={pack.correctedNotes} />}
        </TabsContent>
        <TabsContent value="flashcards" className="study-panel">
          <PanelTitle icon={<Layers3 />} tone="orange" title="Flashcard" subtitle="Tocca una carta per vedere la risposta." />
          <div className="flashcard-grid">{pack.flashcards.map((card, index) => <button key={index} className={"flashcard " + (flipped === index ? "flipped" : "")} onClick={() => setFlipped(flipped === index ? null : index)}><small>{flipped === index ? "RISPOSTA" : "DOMANDA"}</small><p>{flipped === index ? card.back : card.front}</p><span>{flipped === index ? <RotateCcw /> : <ChevronRight />}</span></button>)}</div>
        </TabsContent>
        <TabsContent value="quiz" className="study-panel">
          <PanelTitle icon={<GraduationCap />} tone="green" title="Verifica quello che sai" subtitle={pack.quiz.length ? pack.quiz.length + " domande create dai tuoi appunti." : "Scegli la lunghezza e genera il tuo quiz."} />
          <div className="quiz-builder">
            <div className="quiz-builder-copy"><b>Scegli la lunghezza</b><p>In base al documento, ti consigliamo <strong>{recommendedQuiz} domande</strong>.</p></div>
            <RadioGroup value={String(quizCount)} onValueChange={(value) => setQuizCount(Number(value) as QuizSize)} className="quiz-size-options" aria-label="Numero di domande del quiz">
              {([5, 10, 20] as QuizSize[]).map((size) => <label key={size} className={"quiz-size-option " + (quizCount === size ? "selected" : "")}>
                <RadioGroupItem value={String(size)} className="sr-only" />
                <b>{size}</b><span>domande</span>{recommendedQuiz === size && <small>Consigliato</small>}
              </label>)}
            </RadioGroup>
            <Button onClick={() => void generateQuiz()} disabled={quizLoading}>{quizLoading ? <><span className="spinner" /> Generazione…</> : <><Sparkles /> {pack.quiz.length ? "Genera un nuovo quiz" : "Genera quiz"}</>}</Button>
          </div>
          {submitted && <div className="score-card"><div><b>{score}/{pack.quiz.length}</b><span>Corrette</span></div><Progress value={progress} /><strong>{progress}%</strong></div>}
          <div className="quiz-list">{pack.quiz.map((item, q) => <article key={q} className="quiz-question"><h3><span>{q + 1}</span>{item.question}</h3><div className="options-list">{item.options.map((option, o) => {
            const selected = answers[q] === o, correct = submitted && o === item.correctIndex, wrong = submitted && selected && !correct;
            return <button key={o} disabled={submitted} className={(selected ? "selected " : "") + (correct ? "correct " : "") + (wrong ? "wrong" : "")} onClick={() => setAnswers((a) => ({ ...a, [q]: o }))}><span>{String.fromCharCode(65 + o)}</span>{option}{correct && <Check />}</button>;
          })}</div>{submitted && <p className="explanation">{item.explanation}</p>}</article>)}</div>
          {!!pack.quiz.length && <div className="quiz-actions">{submitted ? <Button variant="outline" onClick={() => { setSubmitted(false); setAnswers({}); }}><RotateCcw /> Riprova</Button> : <Button size="lg" disabled={Object.keys(answers).length !== pack.quiz.length} onClick={() => setSubmitted(true)}>Correggi il quiz</Button>}</div>}
        </TabsContent>
        <TabsContent value="chat" className="study-panel chat-panel">
          <PanelTitle icon={<MessageCircle />} tone="teal" title="Chiedi ai tuoi appunti" subtitle="Le risposte si basano esclusivamente sul quaderno." />
          <div className="chat-thread">{chat.map((message, index) => <div key={index} className={"chat-message " + message.role}><span>{message.role === "assistant" ? <Sparkles /> : "Tu"}</span><p>{message.text}</p></div>)}{chatLoading && <div className="chat-message assistant"><span><Sparkles /></span><p className="typing"><i /><i /><i /></p></div>}</div>
          <div className="chat-composer"><Textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendQuestion(); } }} placeholder="Es. Spiegami questo concetto in modo semplice" /><Button size="icon-lg" onClick={() => void sendQuestion()} disabled={!question.trim() || chatLoading}><Send /></Button></div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

function PanelTitle({ icon, tone, title, subtitle }: { icon: React.ReactNode; tone: string; title: string; subtitle: string }) {
  return <div className="panel-heading"><div className={"panel-icon " + tone}>{icon}</div><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}

function StructuredNotes({ sections }: { sections: NonNullable<StudyPack["noteSections"]> }) {
  return <div className="formatted-notes">{sections.map((section, sectionIndex) => <section className="note-section" key={`${section.title}-${sectionIndex}`}>
    <h3>{section.title}</h3>
    <div className="note-blocks">{section.blocks.map((block, blockIndex) => block.kind === "formula"
      ? <div className="formula-line" key={blockIndex}><small>Formula</small><strong>{block.content.replace(/^\**formula\**\s*:?\s*/i, "")}</strong></div>
      : <div className="note-point" key={blockIndex}><span aria-hidden="true" /><p>{block.content}</p></div>)}</div>
  </section>)}</div>;
}

function FormattedNotes({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  function flushList() {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(<ul key={`list-${blocks.length}`}>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>);
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) { flushList(); return; }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) { flushList(); blocks.push(<h3 key={`heading-${blocks.length}`}>{heading[1]}</h3>); return; }
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.+)$/);
    if (bullet) { list.push(bullet[1].replace(/\*\*/g, "")); return; }
    flushList();
    const cleanLine = line.replace(/\*\*/g, "");
    if (/^FORMULA(?:\s*:)?/i.test(cleanLine)) {
      blocks.push(<div className="formula-line" key={`formula-${blocks.length}`}><small>Formula</small><strong>{cleanLine.replace(/^FORMULA\s*:?\s*/i, "")}</strong></div>);
    } else {
      blocks.push(<p key={`paragraph-${blocks.length}`}>{cleanLine}</p>);
    }
  });
  flushList();

  return <div className="formatted-notes">{blocks}</div>;
}
