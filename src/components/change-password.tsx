import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword } from "@/lib/password.functions";
import { PASSWORD_RULES, checkPassword } from "@/lib/password-policy";

/** Eigenes Passwort ändern — nur für Zugänge mit E-Mail/Passwort. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = useServerFn(changeOwnPassword);
  const mutation = useMutation({
    mutationFn: async () =>
      submit({ data: { currentPassword: current, newPassword: next } }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Passwort wurde geändert.");
    },
    onError: (e: Error) => toast.error(e.message || "Passwort konnte nicht geändert werden."),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ruleError = checkPassword(next);
    if (ruleError) {
      toast.error(ruleError);
      return;
    }
    if (next !== confirm) {
      toast.error("Die Passwortbestätigung stimmt nicht überein.");
      return;
    }
    mutation.mutate();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Aktuelles Passwort</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">Neues Passwort</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">Neues Passwort bestätigen</Label>
        <Input
          id="confirm-password"
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
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Passwort ändern
      </Button>
    </form>
  );
}
