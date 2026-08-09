import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_RULES, checkPassword } from "@/lib/password-policy";

export const Route = createFileRoute("/passwort-neu")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Neues Passwort festlegen – Repenning Geräteportal" },
      {
        name: "description",
        content: "Lege nach dem Reset-Link ein neues Passwort für deinen Repenning Geräteportal-Zugang fest.",
      },
      { property: "og:title", content: "Neues Passwort festlegen – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Lege nach dem Reset-Link ein neues Passwort für deinen Repenning Geräteportal-Zugang fest.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewPasswordPage,
});

function NewPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Der Recovery-Link stellt beim Öffnen eine kurzlebige Session her.
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ruleError = checkPassword(pw);
    if (ruleError) {
      toast.error(ruleError);
      return;
    }
    if (pw !== confirm) {
      toast.error("Die Passwortbestätigung stimmt nicht überein.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      console.error("[password] recovery update failed", error.message);
      toast.error("Passwort konnte nicht gesetzt werden. Bitte fordere einen neuen Link an.");
      return;
    }
    toast.success("Passwort wurde geändert.");
    void navigate({ to: "/dashboard" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <h1 className="mb-1 text-xl font-light text-foreground">Neues Passwort festlegen</h1>
      {!ready ? (
        <p className="text-sm text-muted-foreground">Einen Moment …</p>
      ) : !hasSession ? (
        <p className="text-sm text-muted-foreground">
          Dieser Link ist abgelaufen oder ungültig. Bitte lass dir von der Verwaltung einen neuen
          Reset-Link senden.
        </p>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Neues Passwort</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Neues Passwort bestätigen</Label>
            <Input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {PASSWORD_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Passwort speichern
          </Button>
        </form>
      )}
    </main>
  );
}
