import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  disablePinAccess,
  enablePinAccess,
  listPinAccess,
  resetPin,
  unlockPin,
} from "@/lib/pin-auth.functions";

const ROLE_OPTIONS = [
  { value: "user", label: "Mitarbeiter" },
  { value: "site_manager", label: "Bauleiter" },
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
  const [withPin, setWithPin] = useState(true);
  const [newPin, setNewPin] = useState<string | null>(null);

  const submit = useServerFn(createEmployeeAccount);
  const mutation = useMutation({
    mutationFn: async () => submit({ data: { fullName, email, password, role, withPin } }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["pin-access"] });
      await qc.invalidateQueries({ queryKey: ["account-emails"] });
      const pin = (result as { pin?: string | null }).pin ?? null;
      if (pin) setNewPin(pin);
      else toast.success("Zugang angelegt. Bitte Zugangsdaten an die Person weitergeben.");
      setOpen(false);
      setFullName("");
      setEmail("");
      setPassword(randomPassword());
      setRole("user");
      setWithPin(true);
    },
    onError: (e: Error) => toast.error(e.message || "Zugang konnte nicht angelegt werden."),
  });

  const emailInvalid = email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(email.trim());
  const invalid = fullName.trim().length < 2 || emailInvalid || password.length < 8;

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
              <Label htmlFor="u-mail">E-Mail (optional)</Label>
              <Input
                id="u-mail"
                type="email"
                className="h-11"
                placeholder="Nur für Büro/Admin nötig"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ohne E-Mail meldet sich die Person ausschließlich mit Auswahl + PIN an.
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
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={withPin}
                onChange={(e) => setWithPin(e.target.checked)}
              />
              PIN-Zugang aktivieren
            </label>
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

      <Dialog open={!!newPin} onOpenChange={(o) => (!o ? setNewPin(null) : undefined)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Start-PIN</DialogTitle>
            <DialogDescription>
              Dieser PIN wird genau einmal angezeigt. Gib ihn persönlich weiter — beim ersten Login
              muss die Person einen eigenen PIN setzen.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted/40 py-4 text-center font-mono text-2xl tracking-[0.4em]">
            {newPin}
          </p>
          <DialogFooter>
            <Button onClick={() => setNewPin(null)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Dialog: Bauleiter-/Administrator-Zugang (E-Mail + Passwort) einrichten. */
export function ManagerAccessDialog({
  userId,
  role,
  email,
  open,
  onOpenChange,
}: {
  userId: string;
  role: "site_manager" | "admin";
  email: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(setupManagerAccess);
  const [mail, setMail] = useState(email ?? "");
  const [password, setPassword] = useState(randomPassword);
  const [done, setDone] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () =>
      submit({ data: { userId, role, email: mail.trim(), password } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["pin-access"] });
      await qc.invalidateQueries({ queryKey: ["account-emails"] });
      setDone(password);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Zugang konnte nicht eingerichtet werden."),
  });

  const invalid = !/^\S+@\S+\.\S+$/.test(mail.trim()) || password.length < 8;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (!mutation.isPending ? onOpenChange(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bauleiter-Zugang einrichten</DialogTitle>
            <DialogDescription>
              Dieser Benutzer meldet sich künftig über „Bauleiter“ mit E-Mail und Passwort an. Ein
              vorhandener PIN-Zugang wird erst danach deaktiviert.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-mail">Geschäftliche E-Mail</Label>
              <Input
                id="m-mail"
                type="email"
                className="h-11"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-pass">Startpasswort</Label>
              <div className="flex gap-2">
                <Input
                  id="m-pass"
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
              <p className="text-xs text-muted-foreground">
                Das Passwort wird nur einmal angezeigt und nirgends gespeichert.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Abbrechen
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={invalid || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Zugang einrichten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!done} onOpenChange={(o) => (!o ? setDone(null) : undefined)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Startpasswort</DialogTitle>
            <DialogDescription>
              Bitte persönlich weitergeben. Die Person kann es nach der Anmeldung ändern.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-4 text-center font-mono text-lg break-all">
            {done}
          </p>
          <DialogFooter>
            <Button onClick={() => setDone(null)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Dialog: Mitarbeiter-Zugang (Name + PIN) einrichten bzw. reaktivieren. */
function EmployeeAccessDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(setupEmployeeAccess);
  const [pin, setPin] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => submit({ data: { userId } }),
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      await qc.invalidateQueries({ queryKey: ["pin-access"] });
      setPin((result as { pin: string }).pin);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || "Zugang konnte nicht eingerichtet werden."),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (!mutation.isPending ? onOpenChange(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiter-Zugang einrichten</DialogTitle>
            <DialogDescription>
              Diese Person meldet sich künftig über „Mitarbeiter“ mit Namensauswahl und PIN an. Der
              Start-PIN wird einmalig angezeigt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Abbrechen
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              PIN erstellen &amp; Rolle setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pin} onOpenChange={(o) => (!o ? setPin(null) : undefined)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Start-PIN</DialogTitle>
            <DialogDescription>
              Dieser PIN wird genau einmal angezeigt. Beim ersten Login muss die Person einen
              eigenen PIN setzen.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted/40 py-4 text-center font-mono text-2xl tracking-[0.4em]">
            {pin}
          </p>
          <DialogFooter>
            <Button onClick={() => setPin(null)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UserRowActions({
  user,
  email,
  pinEnabled,
}: {
  user: { id: string; role: string; active: boolean };
  email?: string | null;
  pinEnabled?: boolean;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(updateEmployeeAccount);
  const [managerRole, setManagerRole] = useState<"site_manager" | "admin" | null>(null);
  const [employeeOpen, setEmployeeOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: async (patch: { role?: Role; active?: boolean }) =>
      submit({ data: { userId: user.id, ...patch } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profiles"] });
      toast.success("Änderung gespeichert.");
    },
    onError: (e: Error) => toast.error(e.message || "Änderung fehlgeschlagen."),
  });

  const needsEmailLogin = user.role === "site_manager" || user.role === "admin";
  const missingManagerLogin = needsEmailLogin && !email;

  function onRoleChange(next: Role) {
    if (next === user.role) return;
    // Rolle und Zugang bleiben konsistent: fehlt der passende Login, führt ein
    // Dialog durch die Einrichtung und setzt die Rolle erst danach.
    if ((next === "site_manager" || next === "admin") && !email) {
      setManagerRole(next);
      return;
    }
    if (next === "user" && !pinEnabled) {
      setEmployeeOpen(true);
      return;
    }
    mutation.mutate({ role: next });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        aria-label="Rolle ändern"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={user.role}
        disabled={mutation.isPending}
        onChange={(e) => onRoleChange(e.target.value as Role)}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {missingManagerLogin ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setManagerRole(user.role === "admin" ? "admin" : "site_manager")}
        >
          Bauleiter-Zugang einrichten
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ active: !user.active })}
      >
        {user.active ? "Deaktivieren" : "Aktivieren"}
      </Button>

      {managerRole ? (
        <ManagerAccessDialog
          userId={user.id}
          role={managerRole}
          email={email ?? null}
          open
          onOpenChange={(o) => (!o ? setManagerRole(null) : undefined)}
        />
      ) : null}
      <EmployeeAccessDialog userId={user.id} open={employeeOpen} onOpenChange={setEmployeeOpen} />
    </div>
  );
}

/** Admin controls for the additional PIN login of one employee. */
export function PinAccessActions({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listPinAccess);
  const enable = useServerFn(enablePinAccess);
  const reset = useServerFn(resetPin);
  const disable = useServerFn(disablePinAccess);
  const unlock = useServerFn(unlockPin);

  const [shownPin, setShownPin] = useState<string | null>(null);

  const access = useQuery({
    queryKey: ["pin-access"],
    staleTime: 30_000,
    queryFn: async () => list(),
  });
  const row = (access.data ?? []).find((r) => r.user_id === userId);
  const locked = !!row?.locked_until && new Date(row.locked_until).getTime() > Date.now();

  const run = useMutation({
    mutationFn: async (action: "enable" | "reset" | "disable" | "unlock") => {
      const payload = { data: { userId } };
      if (action === "enable") return enable(payload);
      if (action === "reset") return reset(payload);
      if (action === "disable") return disable(payload);
      return unlock(payload);
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["pin-access"] });
      const pin = (result as { pin?: string }).pin;
      if (pin) setShownPin(pin);
      else toast.success("Änderung gespeichert.");
    },
    onError: (e: Error) => toast.error(e.message || "Änderung fehlgeschlagen."),
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {row?.enabled ? (
          <>
            <span className="text-xs text-muted-foreground">
              PIN aktiv{locked ? " · gesperrt" : row.pin_must_change ? " · Wechsel offen" : ""}
            </span>
            {locked ? (
              <Button
                size="sm"
                variant="outline"
                disabled={run.isPending}
                onClick={() => run.mutate("unlock")}
              >
                Entsperren
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              disabled={run.isPending}
              onClick={() => run.mutate("reset")}
            >
              PIN zurücksetzen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={run.isPending}
              onClick={() => run.mutate("disable")}
            >
              PIN deaktivieren
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={run.isPending}
            onClick={() => run.mutate("enable")}
          >
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            PIN-Zugang aktivieren
          </Button>
        )}
      </div>

      <Dialog open={!!shownPin} onOpenChange={(o) => (!o ? setShownPin(null) : undefined)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Start-PIN</DialogTitle>
            <DialogDescription>
              Dieser PIN wird genau einmal angezeigt. Gib ihn persönlich weiter — beim ersten Login
              muss die Person einen eigenen PIN setzen.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted/40 py-4 text-center font-mono text-2xl tracking-[0.4em]">
            {shownPin}
          </p>
          <DialogFooter>
            <Button onClick={() => setShownPin(null)}>Verstanden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
