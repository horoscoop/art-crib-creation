import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { askCimaise } from "@/lib/cimaise.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Assistant Cimaise — KOA Guardian" }] }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function ChatPage() {
  const ask = useServerFn(askCimaise);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Bonjour. Je suis Cimaise, votre assistant technique KOA. Posez-moi vos questions sur l'accrochage, les fixations adhésives, les seuils de charge ou la maintenance préventive." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: reply }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cimaise indisponible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto flex flex-col h-[calc(100vh-5rem)]">
      <header className="px-5 pt-8 pb-4 border-b border-border">
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Assistant technique</p>
        <h1 className="serif text-3xl mt-1">Cimaise</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "assistant" ? (
              <div className="max-w-[90%]">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Cimaise</p>
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
          placeholder="Une question technique…"
          className="flex-1 bg-transparent text-sm focus:outline-none px-2"
        />
        <Button type="submit" disabled={loading || !input.trim()} size="icon" className="rounded-sm shrink-0">
          <Send className="size-4" />
        </Button>
      </form>
    </main>
  );
}
