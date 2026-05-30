import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/scan")({
  head: () => ({ meta: [{ title: "Scan NFC — KOA Guardian" }] }),
  component: ScanPage,
});

type NDEFLike = { scan: () => Promise<void>; onreading: ((e: { serialNumber?: string }) => void) | null };

function ScanPage() {
  const navigate = useNavigate();
  const { data: artworks = [] } = useQuery({
    queryKey: ["artworks-short"],
    queryFn: async () => {
      const { data, error } = await supabase.from("artworks").select("id,title").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const startScan = async () => {
    const w = window as unknown as { NDEFReader?: new () => NDEFLike };
    if (!w.NDEFReader) {
      toast.info("NFC non disponible sur cet appareil. Sélectionnez une œuvre ci-dessous.");
      return;
    }
    try {
      const reader = new w.NDEFReader();
      await reader.scan();
      toast("Approchez votre puce KOA…");
      reader.onreading = (e) => {
        toast.success(`Puce ${e.serialNumber ?? "—"} détectée`);
        if (artworks[0]) navigate({ to: "/artworks/$id", params: { id: artworks[0].id } });
      };
    } catch {
      toast.error("Scan NFC refusé");
    }
  };

  return (
    <main className="max-w-md mx-auto px-5 pt-10">
      <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Identification</p>
      <h1 className="serif text-4xl mt-1">Scan NFC</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
        Approchez votre téléphone d'un support KOA équipé d'une puce NFC pour accéder à la fiche.
      </p>

      <div className="mt-10 aspect-square border border-dashed border-border grid place-items-center bg-card">
        <div className="text-center">
          <ScanLine className="size-12 mx-auto text-muted-foreground" strokeWidth={1} />
          <p className="mt-4 text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Prêt à scanner</p>
        </div>
      </div>

      <Button onClick={startScan} className="mt-6 w-full rounded-sm h-11 text-xs tracking-[0.2em] uppercase">
        Démarrer le scan
      </Button>

      <div className="mt-10">
        <h2 className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Accès direct</h2>
        <ul className="mt-3 space-y-1">
          {artworks.map((a) => (
            <li key={a.id}>
              <Link to="/artworks/$id" params={{ id: a.id }} className="block py-3 border-b border-border text-sm hover:text-accent">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
