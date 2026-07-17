/**
 * KOA Guardian — _app.chat.tsx étendu avec un sélecteur de mode
 * "Technique" / "Assurance". Un seul point d'entrée (validé), historique
 * localStorage et session distingués par mode pour ne pas mélanger les
 * deux contextes de conversation.
 *
 * REMPLACE ENTIÈREMENT src/routes/_app.chat.tsx.
 * Nécessite cimaise.functions.updated.ts (askCimaise avec paramètre mode)
 * et la migration 0002_add_cimaise_mode.sql.
 *
 * Accessible aussi depuis le module Audit (voir note en bas de fichier)
 * via <Link to="/chat" search={{ mode: "assurance" }}>.
 */
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Trash2 } from "lucide-react";
import { askCimaise } from "@/lib/cimaise.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";

const SearchSchema = z.object({ mode: z.enum(["technique", "assurance"]).optional() });

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Assistant Cimaise — KOA Guardian" }] }),
  validateSearch: SearchSchema,
  component: ChatPage,
});

type Mode = "technique" | "assurance";
type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY: Record<Mode, string> = {
  technique: "koa.cimaise.history.v1",
  assurance: "koa.cimaise.assurance.history.v1",
};

const INTRO: Record<Mode, Msg> = {
  technique: {
    role: "assistant",
    content:
      "Bonjour. Je suis Cimaise, votre assistant technique KOA. Posez-moi vos questions sur l'accrochage, les fixations adhésives, les seuils de charge ou la maintenance préventive.",
  },
  assurance: {
    role: "assistant",
    content:
      "Bonjour. Je suis Cimaise, en mode assurance & conformité. Posez-moi vos questions sur les exigences générales des assureurs d'art en matière d'accrochage et de suivi — je ne remplace pas votre assureur ou courtier pour une clause précise.",
  },
};

function loadHistory(mode: Mode): Msg[] {
  if (typeof window === "undefined") return [INTRO[mode]];
  try {
    const raw = localStorage.getItem(STORAGE_KEY[mode]);
    if (!raw) return [INTRO[mode]];
    const parsed = JSON.parse(raw) as Msg[];
    return Array.isArray(parsed) && parsed.length ? parsed : [INTRO[mode]];
  } catch {
    return [INTRO[mode]];
  }
}

function ChatPage() {
  const search = useSearch({ from: "/_app/chat" });
  const ask = useServerFn(askCimaise);
  const [mode, setMode] = useState<Mode>(search.mode ?? "technique");
  const [messages, setMessages] = useState<Msg[]>([INTRO[mode]]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Hydrate depuis localStorage à chaque changement de mode (évite le mismatch SSR).
  useEffect(() => { setMessages(loadHistory(mode)); }, [mode]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(STORAGE_KEY[mode], JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages, mode]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await ask({ data: { messages: next, mode } });
      setMessages([...next, { role: "assistant", content: reply }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cimaise indisponible");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    if (!confirm("Effacer l'historique de la conversation ?")) return;
    setMessages([INTRO[mode]]);
    try { localStorage.removeItem(STORAGE_KEY[mode]); } catch {}
  };

  return (
    <main className="max-w-md mx-auto flex flex-col h-[calc(100vh-5rem)]">
      <header className="px-5 pt-8 pb-4 border-b border-border">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Assistant</p>
            <h1 className="serif text-3xl mt-1">Cimaise</h1>
          </div>
          {messages.length > 1 && (
            <button onClick={clear} title="Effacer" className="text-muted-foreground hover:text-destructive p-2">
              <Trash2 className="size-4" strokeWidth={1.2} />
            </button>
          )}
        </div>
        {/* Sélecteur de mode — réutilise .gallery-tab (design system Phase 1) */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setMode("technique")}
            className="gallery-tab"
            data-active={mode === "technique"}
          >
            Technique
          </button>
          <button
            onClick={() => setMode("assurance")}
            className="gallery-tab"
            data-active={mode === "assurance"}
          >
            Assurance
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "assistant" ? (
              <div className="max-w-[90%]">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
                  Cimaise {mode === "assurance" ? "· Assurance" : ""}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            ) : (
              <div className="max-w-[85%] bg-primary text-primary-foreground px-4 py-2.5 rounded-sm text-sm">
                {m.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <p className="text-[10px] tracking-widest uppercase text-muted-foreground animate-pulse">Cimaise réfléchit…</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="border-t border-border p-3 flex gap-2 bg-background"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "assurance" ? "Une question conformité / assurance…" : "Une question technique…"}
          className="flex-1 bg-transparent text-sm focus:outline-none px-2"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="icon" className="rounded-sm shrink-0">
          <Send className="size-4" />
        </Button>
      </form>
    </main>
  );
}

/* ============================================================
   NOTE D'INTÉGRATION — accès direct depuis le module Audit :

   Dans ArtworkRegistryList.tsx (ou AuditRegistryBanner.tsx), ajouter
   un lien qui ouvre le chat directement en mode assurance :

     <Link to="/chat" search={{ mode: "assurance" }} className="gallery-tab">
       Consulter les normes assurance →
     </Link>
   ============================================================ */
