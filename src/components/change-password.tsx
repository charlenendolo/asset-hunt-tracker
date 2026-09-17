import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { changeOwnPassword } from "@/lib/password.functions";
import { checkPassword, passwordChecks } from "@/lib/password-policy";

/** Passwortfeld mit Anzeigen/Verbergen — wie auf der Anmeldeseite. */
function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          required
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** Eigenes Passwort ändern — für alle angemeldeten Benutzer. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const navigate = useNavigate();

  const submit = useServerFn(changeOwnPassword);
  const mutation = useMutation({
    mutationFn: async () =>
      submit({ data: { currentPassword: current, newPassword: next } }),
    onSuccess: async () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Dein Passwort wurde geändert. Bitte melde dich erneut an.");
      await supabase.auth.signOut();
      await navigate({ to: "/auth" });
    },
    onError: (e: Error) => toast.error(e.message || "Passwort konnte nicht geändert werden."),
  });

  const checks = passwordChecks(next);
  const matches = next.length > 0 && next === confirm;

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
      <PasswordField
        id="current-password"
        label="Aktuelles Passwort"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <PasswordField
        id="new-password"
        label="Neues Passwort"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <PasswordField
        id="confirm-password"
        label="Neues Passwort bestätigen"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <ul className="space-y-0.5 text-xs">
        {checks.map((c) => (
          <li
            key={c.label}
            className={c.ok ? "flex items-center gap-1.5 text-primary" : "flex items-center gap-1.5 text-muted-foreground"}
          >
            {c.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {c.label}
          </li>
        ))}
        {confirm.length > 0 ? (
          <li
            className={matches ? "flex items-center gap-1.5 text-primary" : "flex items-center gap-1.5 text-destructive"}
          >
            {matches ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            Passwörter stimmen überein
          </li>
        ) : null}
      </ul>

      <Button
        type="submit"
        disabled={mutation.isPending || !current || !matches || checkPassword(next) !== null}
      >
        {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Passwort ändern
      </Button>
    </form>
  );
}
