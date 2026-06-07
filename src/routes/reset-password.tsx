import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Réinitialiser — KOA Guardian" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("6 caractères minimum"); return; }
    if (password !== confirm) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="px-6 pt-14 pb-8 text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">KOA Guardian</p>
        <h1 className="serif text-4xl mt-2">Nouveau mot de passe</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xs mx-auto">
          {ready ? "Choisissez un nouveau mot de passe." : "Validation du lien de réinitialisation…"}
        </p>
      </div>

      <form onSubmit={submit} className="px-6 space-y-4 max-w-md w-full mx-auto">
        <div>
          <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Nouveau mot de passe</Label>
          <Input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="mt-1 rounded-sm border-0 border-b border-border bg-transparent focus-visible:ring-0 focus-visible:border-foreground px-0 h-10"
          />
        </div>
        <div>
          <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Confirmer</Label>
          <Input
            type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required
            className="mt-1 rounded-sm border-0 border-b border-border bg-transparent focus-visible:ring-0 focus-visible:border-foreground px-0 h-10"
          />
        </div>
        <Button type="submit" disabled={loading || !ready} className="w-full rounded-sm h-11 text-xs tracking-[0.2em] uppercase">
          Mettre à jour
        </Button>
      </form>
    </div>
  );
}
