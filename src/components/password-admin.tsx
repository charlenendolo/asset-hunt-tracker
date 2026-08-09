import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Mail } from "lucide-react";
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
import { PASSWORD_RULES, checkPassword } from "@/lib/password-policy";

/**
 * Admin-Aktionen für Zugänge mit E-Mail/Passwort.
 * Standard ist der Reset-Link; das temporäre Passwort ist die Ausweichoption
 * und wird nach dem Setzen weder angezeigt noch gespeichert.
 */
export function PasswordAdminActions({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const sendReset = useServerFn(sendPasswordReset);
  const setTemp = useServerFn(setTemporaryPassword);

  const reset = useMutation({
    mutationFn: async () =>
      sendReset({ data: { userId, redirectTo: `${appBaseUrl()}/passwort-neu` } }),
    onSuccess: (r) => toast.success(`Reset-Link an ${(r as { email: string }).email} gesendet.`),
    onError: (e: Error) => toast.error(e.message || "Reset-Link konnte nicht gesendet werden."),
  });

  const temp = useMutation({
    mutationFn: async () => setTemp({ data: { userId, password: pw } }),
    onSuccess: () => {
      setPw("");
      setConfirm("");
      setOpen(false);
      toast.success("Temporäres Passwort wurde gesetzt.");
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Passwort</span>
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
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <KeyRound className="mr-2 h-4 w-4" strokeWidth={1.75} />
        Temporäres Passwort
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Temporäres Passwort setzen</DialogTitle>
            <DialogDescription>
              Gib das Passwort persönlich weiter. Es wird nirgends gespeichert und lässt sich später
              nicht mehr anzeigen.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitTemp}>
            <div className="space-y-1.5">
              <Label htmlFor={`temp-pw-${userId}`}>Neues Passwort</Label>
              <Input
                id={`temp-pw-${userId}`}
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`temp-pw2-${userId}`}>Passwort bestätigen</Label>
              <Input
                id={`temp-pw2-${userId}`}
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
            <DialogFooter>
              <Button type="submit" disabled={temp.isPending}>
                {temp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Passwort setzen
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
