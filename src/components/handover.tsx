import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRightLeft, Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { profilesQuery } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import {
  getMachineHandover,
  listAllHandovers,
  listMyHandovers,
  requestHandover,
  respondHandover,
  withdrawHandover,
  type HandoverRow,
} from "@/lib/handovers.functions";
import { cn } from "@/lib/utils";

function useRefreshHandovers() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["handovers"] }),
      qc.invalidateQueries({ queryKey: ["machine"] }),
      qc.invalidateQueries({ queryKey: ["machines"] }),
      qc.invalidateQueries({ queryKey: ["defects"] }),
    ]);
}

/* ---------------------------------------------------------------- Absender */

function RequestDialog({
  machineId,
  machineName,
  onClose,
}: {
  machineId: string;
  machineName: string;
  onClose: () => void;
}) {
  const identity = useIdentity();
  const profiles = useQuery(profilesQuery);
  const refresh = useRefreshHandovers();
  const run = useServerFn(requestHandover);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const people = useMemo(
    () => (profiles.data ?? []).filter((p) => p.active !== false && p.id !== identity.userId),
    [profiles.data, identity.userId],
  );
  const selectedName = people.find((p) => p.id === selected)?.full_name ?? null;

  const mutation = useMutation({
    mutationFn: async () =>
      run({ data: { machineId, toUserId: selected!, note: note.trim() || null } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Übergabe angefragt. Sie wird erst mit der Bestätigung wirksam.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Übergabe fehlgeschlagen."),
  });

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät übergeben</DialogTitle>
          <DialogDescription>{machineName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="handover-person">Empfänger auswählen</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="handover-person"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="h-12 w-full justify-between font-normal"
                >
                  <span className="truncate">{selectedName ?? "Mitarbeiter suchen"}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Name eingeben" />
                  <CommandList>
                    <CommandEmpty>Keine Person gefunden.</CommandEmpty>
                    <CommandGroup>
                      {people.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.full_name ?? p.id}
                          onSelect={() => {
                            setSelected(p.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selected === p.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {p.full_name ?? "Ohne Namen"}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="handover-note">Notiz (optional)</Label>
            <Textarea
              id="handover-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z. B. Übergabe auf der Baustelle"
            />
          </div>

          {selectedName ? (
            <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              Gerät an <span className="font-medium">{selectedName}</span> übergeben? Die Übergabe
              ist erst abgeschlossen, wenn {selectedName} den Empfang bestätigt. Bis dahin bleibst
              du verantwortlich.
            </p>
          ) : null}
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            className="h-12 w-full text-base"
            disabled={!selected || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Übergabe anfragen
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------------------- Empfänger */

export function AcceptHandoverDialog({
  handover,
  onClose,
}: {
  handover: HandoverRow;
  onClose: () => void;
}) {
  const identity = useIdentity();
  const refresh = useRefreshHandovers();
  const run = useServerFn(respondHandover);

  const [condition, setCondition] = useState<"good" | "defect">("good");
  const [description, setDescription] = useState("");
  const [pin, setPin] = useState("");

  const pinNeeded = !identity.canManage;

  const mutation = useMutation({
    mutationFn: async (action: "accept" | "reject") =>
      run({
        data: {
          handoverId: handover.id,
          action,
          condition,
          defectDescription: condition === "defect" ? description.trim() : null,
          pin: action === "accept" && pinNeeded ? pin : null,
        },
      }),
    onSuccess: async (_res, action) => {
      await refresh();
      toast.success(
        action === "accept"
          ? "Gerät übernommen. Du bist jetzt verantwortlich."
          : "Übergabe abgelehnt.",
      );
      setPin("");
      onClose();
    },
    onError: (error: Error) => {
      setPin("");
      toast.error(error.message || "Vorgang fehlgeschlagen.");
    },
  });

  const blocked =
    (condition === "defect" && description.trim().length < 5) ||
    (pinNeeded && !/^\d{4}$/.test(pin));

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät übernehmen</DialogTitle>
          <DialogDescription>
            {handover.machineName} · {handover.assetCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Von: <span className="font-medium text-foreground">{handover.fromName}</span>
            </p>
            <p className="text-muted-foreground">Standort: {handover.siteName ?? "–"}</p>
            <p className="text-muted-foreground">Angefragt: {formatDateTime(handover.createdAt)}</p>
            {handover.note ? <p className="text-foreground">{handover.note}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>Zustand bestätigen</Label>
            <div className="grid gap-2">
              {(
                [
                  { value: "good", label: "Zustand in Ordnung" },
                  { value: "defect", label: "Defekt festgestellt" },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setCondition(o.value)}
                  className={cn(
                    "rounded-md border px-4 py-3 text-left text-sm transition-colors",
                    condition === o.value
                      ? "border-primary bg-primary/8 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {condition === "defect" ? (
            <div className="space-y-1.5">
              <Label htmlFor="handover-defect">Defekt beschreiben</Label>
              <Textarea
                id="handover-defect"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Was ist beschädigt oder funktioniert nicht?"
              />
              <p className="text-xs text-muted-foreground">
                Der Defekt wird erfasst. Wenn du das Gerät übernimmst, bleibt es als defekt
                gesperrt.
              </p>
            </div>
          ) : null}

          {pinNeeded ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 px-4 py-4">
              <Label htmlFor="handover-pin" className="text-sm font-semibold">
                Übernahme mit PIN bestätigen
              </Label>
              <input
                id="handover-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="h-14 w-full rounded-md border border-input bg-background px-4 text-center text-2xl tracking-[0.6em]"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            className="h-12 w-full text-base"
            disabled={mutation.isPending || blocked}
            onClick={() => mutation.mutate("accept")}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Gerät übernehmen
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate("reject")}
          >
            Ablehnen
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------- Gerätepass-Bereich */

export function MachineHandoverSection({
  machine,
  className,
}: {
  machine: { id: string; name: string; responsible_user_id: string | null; status: string | null };
  className?: string;
}) {
  const identity = useIdentity();
  const refresh = useRefreshHandovers();
  const [requesting, setRequesting] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const doWithdraw = useServerFn(withdrawHandover);

  const pending = useQuery({
    queryKey: ["handovers", "machine", machine.id],
    queryFn: () => getMachineHandover({ data: { machineId: machine.id } }),
    enabled: !!identity.userId && !!machine.responsible_user_id,
    staleTime: 15 * 1000,
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => doWithdraw({ data: { handoverId: id } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Übergabe zurückgezogen.");
    },
    onError: (error: Error) => toast.error(error.message || "Vorgang fehlgeschlagen."),
  });

  if (identity.isLoading || !identity.userId || !machine.responsible_user_id) return null;

  const row = pending.data ?? null;
  const isHolder = machine.responsible_user_id === identity.userId;

  if (row) {
    const isReceiver = row.toUserId === identity.userId;
    return (
      <div className={cn("space-y-3", className)}>
        <div className="rounded-lg border border-status-reserved/25 bg-status-reserved/8 px-4 py-3 text-sm">
          <p className="font-medium text-status-reserved">Übergabe ausstehend</p>
          <p className="text-muted-foreground">
            Von: {row.fromName} · An: {row.toName}
          </p>
          <p className="text-xs text-muted-foreground">
            Angefragt {formatDateTime(row.createdAt)} · gültig bis {formatDateTime(row.expiresAt)}
          </p>
        </div>
        {isReceiver ? (
          <Button className="h-12 w-full text-base" onClick={() => setAccepting(true)}>
            Übergabe prüfen
          </Button>
        ) : null}
        {row.fromUserId === identity.userId ? (
          <Button
            variant="outline"
            className="h-11 w-full"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate(row.id)}
          >
            Übergabe zurückziehen
          </Button>
        ) : null}
        {accepting ? (
          <AcceptHandoverDialog handover={row} onClose={() => setAccepting(false)} />
        ) : null}
      </div>
    );
  }

  if (!isHolder) return null;

  return (
    <div className={className}>
      <Button
        variant="outline"
        className="h-12 w-full text-base"
        onClick={() => setRequesting(true)}
      >
        <ArrowRightLeft className="mr-2 h-4 w-4" /> Gerät übergeben
      </Button>
      {requesting ? (
        <RequestDialog
          machineId={machine.id}
          machineName={machine.name}
          onClose={() => setRequesting(false)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------- Eigene offene Übergaben */

export function PendingHandovers() {
  const identity = useIdentity();
  const [active, setActive] = useState<HandoverRow | null>(null);
  const data = useQuery({
    queryKey: ["handovers", "mine", identity.userId],
    queryFn: () => listMyHandovers(),
    enabled: !!identity.userId,
    staleTime: 15 * 1000,
  });

  const incoming = data.data?.incoming ?? [];
  const outgoing = data.data?.outgoing ?? [];
  if (!identity.userId || (incoming.length === 0 && outgoing.length === 0)) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">Übergaben</h2>
        {incoming.length > 0 ? (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            {incoming.length} ausstehende Übergabe{incoming.length === 1 ? "" : "n"}
          </span>
        ) : null}
      </div>

      <ul className="divide-y divide-border">
        {incoming.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {h.machineName} · {h.assetCode}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Von {h.fromName} · {h.siteName ?? "ohne Standort"} · {formatDateTime(h.createdAt)}
              </p>
            </div>
            <Button className="h-10" onClick={() => setActive(h)}>
              Übergabe prüfen
            </Button>
          </li>
        ))}
        {outgoing.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {h.machineName} · {h.assetCode}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Wartet auf Bestätigung von {h.toName}
              </p>
            </div>
            <Link
              to="/maschine/$machineId"
              params={{ machineId: h.machineId }}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Öffnen
            </Link>
          </li>
        ))}
      </ul>

      {active ? <AcceptHandoverDialog handover={active} onClose={() => setActive(null)} /> : null}
    </section>
  );
}

/* -------------------------------------------------------- Adminübersicht */

const STATUS_LABEL: Record<HandoverRow["status"], string> = {
  pending: "Offen",
  accepted: "Bestätigt",
  rejected: "Abgelehnt",
  withdrawn: "Zurückgezogen",
  expired: "Abgelaufen",
};

export function AdminHandovers() {
  const identity = useIdentity();
  const data = useQuery({
    queryKey: ["handovers", "all"],
    queryFn: () => listAllHandovers(),
    enabled: identity.isAdmin,
    staleTime: 30 * 1000,
  });

  if (!identity.isAdmin) return null;
  if (data.isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;

  const rows = data.data ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-base font-medium text-foreground">Geräteübergaben</h2>
      <ul className="divide-y divide-border">
        {rows.slice(0, 10).map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
              {h.machineName} · {h.assetCode}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {h.fromName} → {h.toName} · {formatDateTime(h.createdAt)}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {STATUS_LABEL[h.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
