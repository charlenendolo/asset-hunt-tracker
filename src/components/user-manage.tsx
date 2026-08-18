import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Trash2 } from "lucide-react";
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
import {
  deleteEmployeeAccount,
  getDeletionCheck,
  updateEmployeeAccount,
} from "@/lib/users.functions";

const ROLE_OPTIONS = [
  { value: "user", label: "Mitarbeiter" },
  { value: "site_manager", label: "Bauleiter" },
  { value: "admin", label: "Administrator" },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]["value"];

async function refreshUsers(qc: ReturnType<typeof useQueryClient>) {
  await qc.invalidateQueries({ queryKey: ["profiles"] });
  await qc.invalidateQueries({ queryKey: ["account-emails"] });
  await qc.invalidateQueries({ queryKey: ["pin-access"] });
}

/** Bestehenden Benutzer bearbeiten — es entsteht nie ein zweiter Datensatz. */
export function EditUserDialog({
  user,
  email,
}: {
  user: { id: string; full_name: string | null; role: string; active: boolean };
  email: string | null;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(updateEmployeeAccount);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [mail, setMail] = useState(email ?? "");
  const [role, setRole] = useState<Role>((user.role as Role) ?? "user");

  const save = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          userId: user.id,
          fullName: fullName.trim(),
          role,
          ...(mail.trim() || email ? { email: mail.trim() } : {}),
        },
      }),
    onSuccess: async (r) => {
      await refreshUsers(qc);
      setOpen(false);
      toast.success(
        (r as { sessionsRevoked?: boolean }).sessionsRevoked
          ? "Gespeichert. Alle aktiven Sitzungen wurden beendet."
          : "Änderungen gespeichert.",
      );
    },
    onError: (e: Error) => toast.error(e.message || "Änderung fehlgeschlagen."),
  });

  const mailInvalid = mail.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(mail.trim());
  const needsEmail = role !== "user";
  const invalid =
    fullName.trim().length < 2 || mailInvalid || (needsEmail && mail.trim().length === 0);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" strokeWidth={1.75} /> Bearbeiten
      </Button>
      <Dialog open={open} onOpenChange={(o) => (!save.isPending ? setOpen(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>
              Name, E-Mail und Rolle dieses Zugangs. Der bestehende Benutzer wird aktualisiert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`e-name-${user.id}`}>Name</Label>
              <Input
                id={`e-name-${user.id}`}
                className="h-11"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-mail-${user.id}`}>E-Mail</Label>
              <Input
                id={`e-mail-${user.id}`}
                type="email"
                className="h-11"
                placeholder={role === "user" ? "Optional bei PIN-Zugang" : "Pflicht für Bauleiter"}
                value={mail}
                onChange={(e) => setMail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-role-${user.id}`}>Rolle</Label>
              <select
                id={`e-role-${user.id}`}
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
              <p className="text-xs text-muted-foreground">
                Rollenwechsel beendet die aktiven Sitzungen dieser Person.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={save.isPending}>
              Abbrechen
            </Button>
            <Button onClick={() => save.mutate()} disabled={invalid || save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** „Benutzer löschen“ — archiviert den Zugang, Historie bleibt erhalten. */
export function DeleteUserDialog({
  user,
}: {
  user: { id: string; full_name: string | null };
}) {
  const qc = useQueryClient();
  const check = useServerFn(getDeletionCheck);
  const remove = useServerFn(deleteEmployeeAccount);
  const [open, setOpen] = useState(false);

  const preflight = useMutation({
    mutationFn: async () => check({ data: { userId: user.id } }),
    onSuccess: () => setOpen(true),
    onError: (e: Error) => toast.error(e.message || "Prüfung fehlgeschlagen."),
  });

  const del = useMutation({
    mutationFn: async (cancelReservations: boolean) =>
      remove({ data: { userId: user.id, cancelReservations } }),
    onSuccess: async () => {
      await refreshUsers(qc);
      setOpen(false);
      toast.success("Benutzer entfernt. Sitzungen beendet, Historie bleibt erhalten.");
    },
    onError: (e: Error) => toast.error(e.message || "Benutzer konnte nicht entfernt werden."),
  });

  const info = preflight.data;
  const machines = info?.machines ?? [];
  const reservations = info?.reservations ?? [];
  const blocked = machines.length > 0 || !!info?.isSelf;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        disabled={preflight.isPending}
        onClick={() => preflight.mutate()}
      >
        {preflight.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
        )}
        Benutzer löschen
      </Button>

      <Dialog open={open} onOpenChange={(o) => (!del.isPending ? setOpen(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer löschen?</DialogTitle>
            <DialogDescription>
              {user.full_name ?? "Diese Person"} wird aus der aktiven Benutzerverwaltung entfernt
              und kann sich anschließend nicht mehr anmelden. Historische Gerätebewegungen bleiben
              erhalten.
            </DialogDescription>
          </DialogHeader>

          {info?.isSelf ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              Du kannst deinen eigenen Zugang nicht löschen.
            </p>
          ) : null}

          {machines.length > 0 ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium">
                Diese Person hat noch {machines.length} Gerät(e) ausgeliehen. Bitte zuerst
                zurückgeben oder die Zuordnung klären.
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {machines.map((m) => (
                  <li key={m.id}>{m.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {reservations.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {reservations.length} aktive Reservierung(en) werden storniert:
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {reservations.map((r) => (
                  <li key={r.id}>{r.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={del.isPending}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={blocked || del.isPending}
              onClick={() => del.mutate(reservations.length > 0)}
            >
              {del.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Benutzer löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
