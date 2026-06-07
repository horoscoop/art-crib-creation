import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — KOA Guardian" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, organization: org }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Compte créé");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    if (!email) { toast.error("Saisissez votre email d'abord"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de réinitialisation envoyé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Connexion Google impossible"); setLoading(false); return; }
    if (r.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="px-6 pt-14 pb-8 text-center">
        <p className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground">Kingdom of Arts</p>
        <h1 className="serif text-5xl mt-2">KOA Guardian</h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xs mx-auto">
          La sentinelle silencieuse de vos œuvres.
        </p>
      </div>

      <form onSubmit={handle} className="px-6 space-y-4 max-w-md w-full mx-auto">
        {mode === "signup" && (
          <>
            <Field label="Nom complet" value={name} onChange={setName} />
            <Field label="Institution / Collection" value={org} onChange={setOrg} />
          </>
        )}
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <Field label="Mot de passe" type="password" value={password} onChange={setPassword} required />

        <Button type="submit" disabled={loading} className="w-full rounded-sm h-11 text-xs tracking-[0.2em] uppercase">
          {mode === "signin" ? "Se connecter" : "Créer un compte"}
        </Button>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> ou <div className="flex-1 h-px bg-border" />
        </div>

        <Button type="button" variant="outline" onClick={google} disabled={loading}
          className="w-full rounded-sm h-11 text-xs tracking-[0.2em] uppercase">
          Continuer avec Google
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="block mx-auto mt-6 text-xs text-muted-foreground underline underline-offset-4"
        >
          {mode === "signin" ? "Pas encore de compte ? Créer un accès" : "Déjà un compte ? Se connecter"}
        </button>
      </form>

      <p className="mt-auto py-8 text-center text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
        Conservation préventive · v1
      </p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 rounded-sm border-0 border-b border-border bg-transparent focus-visible:ring-0 focus-visible:border-foreground px-0 h-10"
      />
    </div>
  );
}
