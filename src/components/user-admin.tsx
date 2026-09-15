import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

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
import { createEmployeeAccount } from "@/lib/users.functions";
import { isValidUsername, normalizeUsername, USERNAME_HINT } from "@/lib/username";

const ROLE_OPTIONS = [
  { value: "user", label: "Mitarbeiter" },
  { value: "site_manager", label: "Bauleiter" },
  { value: "warehouse_manager", label: "Lagerverwalter" },
  { value: "admin", label: "Administrator" },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]["value"];

/** Startpasswort nach der geltenden Passwortregel (Groß, klein, Ziffer, Sonderzeichen). */
function randomPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!?#%*+-";
  const all = upper + lower + digits + special;
  const pick = (set: string, n: number) =>
    Array.from(crypto.getRandomValues(new Uint32Array(n)), (b) => set[b % set.length]);
  const chars = [
    ...pick(upper, 2),
    ...pick(lower, 5),
    ...pick(digits, 3),
    ...pick(special, 2),
    ...pick(all, 2),
  ];
  const order = crypto.getRandomValues(new Uint32Array(chars.length));
  return chars
    .map((c, i) => ({ c, k: order[i]! }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c)
    .join("");
}

export function CreateUserDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [role, setRole] = useState<Role>("user");

  const submit = useServerFn(createEmployeeAccount);
  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          fullName,
          email,
          username: normalizeUsername(username),
          password,
          role,
          withPin: false,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["account-emails"] });
      toast.success("Zugang angelegt. Bitte Zugangsdaten an die Person weitergeben.");
      setOpen(false);
      setFullName("");
      setEmail("");
      setUsername("");
      setPassword(randomPassword());
      setRole("user");
    },
    onError: (e: Error) => toast.error(e.message || "Zugang konnte nicht angelegt werden."),
  });

  const emailInvalid = email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(email.trim());
  const usernameInvalid = username.trim().length > 0 && !isValidUsername(username);
  const invalid =
    fullName.trim().length < 2 || emailInvalid || usernameInvalid || password.length < 8;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Zugang anlegen
      </Button>
      <Dialog open={open} onOpenChange={(o) => (!mutation.isPending ? setOpen(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzerzugang anlegen</DialogTitle>
            <DialogDescription>
              Der Zugang ist sofort aktiv. Das Startpasswort bitte persönlich übergeben.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Name</Label>
              <Input
                id="u-name"
                className="h-11"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Benutzername</Label>
              <Input
                id="u-username"
                className="h-11"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="z. B. max.mustermann"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p
                className={`text-xs ${usernameInvalid ? "text-destructive" : "text-muted-foreground"}`}
              >
                {USERNAME_HINT}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-mail">E-Mail (optional)</Label>
              <Input
                id="u-mail"
                type="email"
                className="h-11"
                placeholder="Nur für Bauleiter/Admin nötig"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ohne E-Mail meldet sich die Person mit Benutzername und Passwort an.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-role">Rolle</Label>
              <select
                id="u-role"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-pass">Startpasswort</Label>
              <div className="flex gap-2">
                <Input
                  id="u-pass"
                  className="h-11 font-mono"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  onClick={() => setPassword(randomPassword())}
                >
                  Neu
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Abbrechen
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={invalid || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
