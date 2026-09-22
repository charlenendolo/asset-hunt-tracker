import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Mail, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appBaseUrl } from "@/lib/app-url";
import { sendPasswordReset, setTemporaryPassword } from "@/lib/password.functions";
import { checkPassword, passwordChecks, suggestPassword } from "@/lib/password-policy";

/** Reset-Link an die hinterlegte E-Mail senden (Admin-Aktion, serverseitig geprüft). */
export function useSendResetLink(userId: string) {
  const sendReset = useServerFn(sendPasswordReset);
  return useMutation({
    mutationFn: async () =>
      sendReset({ data: { userId, redirectTo: `${appBaseUrl()}/passwort-neu` } }),
    onSuccess: (r) => toast.success(`Reset-Link an ${(r as { email: string }).email} gesendet.`),
    onError: (e: Error) => toast.error(e.message || "Reset-Link konnte nicht gesendet werden."),
  });
}

/**
 * Admin-Dialog zum Setzen eines neuen Passworts.
 * Das Passwort wird weder angezeigt noch gespeichert; Sitzungen werden beendet.
 */
export function PasswordChangeDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const setTemp = useServerFn(setTemporaryPassword);

  /** Vorschlag erzeugen: beide Felder füllen und sichtbar machen, damit er weitergegeben werden kann. */
  function generate() {
    const value = suggestPassword();
    setPw(value);
    setConfirm(value);
    setVisible(true);
    setCopied(false);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(pw);
      setCopied(true);
      toast.success("Passwort in die Zwischenablage kopiert.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren nicht möglich. Bitte das Passwort manuell übernehmen.");
    }
  }

  const temp = useMutation({
    mutationFn: async () => setTemp({ data: { userId, password: pw } }),
    onSuccess: () => {
      setPw("");
      setConfirm("");
      setVisible(false);
      setCopied(false);
      onOpenChange(false);
      toast.success("Passwort geändert. Alle aktiven Sitzungen wurden beendet.");
    },
    onError: (e: Error) => toast.error(e.message || "Passwort konnte nicht gesetzt werden."),
  });

  function submitTemp(e: React.FormEvent) {
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
    temp.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Passwort ändern</DialogTitle>
          <DialogDescription>
            Das neue Passwort ersetzt das bisherige und wird nirgends gespeichert oder angezeigt.
            Alle aktiven Sitzungen dieser Person werden beendet.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submitTemp}>
          <div className="space-y-1.5">
            <Label htmlFor={`temp-pw-${userId}`}>Neues Passwort</Label>
            <div className="flex gap-2">
              <Input
                id={`temp-pw-${userId}`}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
                title={visible ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                {visible ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.75} />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={generate}>
                <Wand2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
                Passwort vorschlagen
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!pw}
                onClick={() => void copyToClipboard()}
              >
                {copied ? (
                  <Check className="mr-2 h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Copy className="mr-2 h-4 w-4" strokeWidth={1.75} />
                )}
                Kopieren
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Der Vorschlag erfüllt alle Regeln. Bitte vor dem Speichern kopieren – danach ist er
              nicht mehr einsehbar.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`temp-pw2-${userId}`}>Passwort bestätigen</Label>
            <Input
              id={`temp-pw2-${userId}`}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <ul className="space-y-0.5 text-xs">
            {passwordChecks(pw).map((r) => (
              <li
                key={r.label}
                className={r.ok ? "text-primary" : "text-muted-foreground"}
                aria-checked={r.ok}
                role="checkbox"
              >
                {r.ok ? "✓" : "•"} {r.label}
              </li>
            ))}
            <li
              className={
                confirm.length > 0 && pw === confirm ? "text-primary" : "text-muted-foreground"
              }
            >
              {confirm.length > 0 && pw === confirm ? "✓" : "•"} Passwörter stimmen überein
            </li>
          </ul>
          <DialogFooter>
            <Button type="submit" disabled={temp.isPending}>
              {temp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Passwort setzen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Kompakte Passwort-Aktionen (Reset-Link + Passwort ändern) für Detailansichten. */
export function PasswordAdminActions({ userId, email }: { userId: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const reset = useSendResetLink(userId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Passwort</span>
      {email ? (
        <Button
          size="sm"
          variant="outline"
          disabled={reset.isPending}
          onClick={() => reset.mutate()}
          title={`Reset-Link an ${email}`}
        >
          {reset.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" strokeWidth={1.75} />
          )}
          Reset-Link senden
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" strokeWidth={1.75} />
        Passwort ändern
      </Button>
      <PasswordChangeDialog userId={userId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
