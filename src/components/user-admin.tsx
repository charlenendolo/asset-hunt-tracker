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
import { createEmployeeAccount, updateEmployeeAccount } from "@/lib/users.functions";

const ROLE_OPTIONS = [
  { value: "user", label: "Mitarbeiter" },
  { value: "manager", label: "Bauleiter" },
  { value: "office", label: "Büro" },
  { value: "admin", label: "Administrator" },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]["value"];

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function CreateUserDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [role, setRole] = useState<Role>("user");

  const submit = useServerFn(createEmployeeAccount);
  const mutation = useMutation({
    mutationFn: async () => submit({ data: { fullName, email, password, role } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Zugang angelegt. Bitte Zugangsdaten an die Person weitergeben.");
      setOpen(false);
      setFullName("");
      setEmail("");
      setPassword(randomPassword());
      setRole("user");
    },
    onError: (e: Error) => toast.error(e.message || "Zugang konnte nicht angelegt werden."),
  });

  const invalid = fullName.trim().length < 2 || !email.includes("@") || password.length < 8;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Zugang anlegen
      </Button>
      <Dialog open={open} onOpenChange={(o) => (!mutation.isPending ? setOpen(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiterzugang anlegen</DialogTitle>
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
              <Label htmlFor="u-mail">E-Mail</Label>
              <Input
                id="u-mail"
                type="email"
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
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

export function UserRowActions({
  user,
}: {
  user: { id: string; role: string; active: boolean };
}) {
  const qc = useQueryClient();
  const submit = useServerFn(updateEmployeeAccount);
  const mutation = useMutation({
    mutationFn: async (patch: { role?: Role; active?: boolean }) =>
      submit({ data: { userId: user.id, ...patch } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Änderung gespeichert.");
    },
    onError: (e: Error) => toast.error(e.message || "Änderung fehlgeschlagen."),
  });

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Rolle ändern"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={user.role}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate({ role: e.target.value as Role })}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ active: !user.active })}
      >
        {user.active ? "Deaktivieren" : "Aktivieren"}
      </Button>
    </div>
  );
}
