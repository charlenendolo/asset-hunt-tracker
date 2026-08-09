import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIdentity } from "@/hooks/use-identity";
import { closeDefect, reportDefect } from "@/lib/defects.functions";
import { cn } from "@/lib/utils";

const SEVERITIES = [
  { value: "minor", label: "Gering" },
  { value: "normal", label: "Normal" },
  { value: "critical", label: "Kritisch" },
];

function useRefreshDefects() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["defects"] }),
      qc.invalidateQueries({ queryKey: ["machine"] }),
      qc.invalidateQueries({ queryKey: ["machines"] }),
      qc.invalidateQueries({ queryKey: ["planner"] }),
    ]);
}

/** Defekt melden — für alle angemeldeten Mitarbeiter. */
export function ReportDefectButton({
  machineId,
  machineName,
  siteId,
  label = "Defekt melden",
  variant = "outline",
  className,
}: {
  machineId: string;
  machineName: string;
  siteId?: string | null;
  label?: string;
  variant?: "outline" | "default";
  className?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("normal");
  const refresh = useRefreshDefects();
  const run = useServerFn(reportDefect);

  const mutation = useMutation({
    mutationFn: async () =>
      run({
        data: {
          machineId,
          description: description.trim(),
          severity: severity as "normal",
          siteId: siteId ?? null,
          blockMachine: true,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Defekt wurde erfasst. Das Gerät ist jetzt als defekt gesperrt.");
      setDescription("");
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Defekt konnte nicht erfasst werden."),
  });

  if (identity.isLoading || !identity.userId) return null;

  return (
    <>
      <Button variant={variant} className={cn(className)} onClick={() => setOpen(true)}>
        <TriangleAlert className="mr-2 h-4 w-4" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => (!mutation.isPending ? setOpen(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Defekt erfassen</DialogTitle>
            <DialogDescription>{machineName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="severity">Schweregrad</Label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defect-description">Beschreibung</Label>
              <Textarea
                id="defect-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Was ist defekt? Was funktioniert nicht mehr?"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Das Gerät wird mit dem Status „Defekt“ gesperrt, bis der Vorgang abgeschlossen ist.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-11 w-full"
              disabled={description.trim().length < 5 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Defekt melden
            </Button>
            <Button
              variant="ghost"
              className="h-10 w-full"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Defekt abschließen — nur Administratoren und Bauleiter. */
export function CloseDefectButton({
  defectId,
  machineName,
  className,
}: {
  defectId: string;
  machineName: string;
  className?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [setAvailable, setSetAvailable] = useState(true);
  const refresh = useRefreshDefects();
  const run = useServerFn(closeDefect);

  const mutation = useMutation({
    mutationFn: async () => run({ data: { defectId, note: note.trim(), setAvailable } }),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        result.machineFreed
          ? "Defekt abgeschlossen. Das Gerät ist wieder verfügbar."
          : "Defekt abgeschlossen. Der Gerätestatus bleibt vorerst unverändert.",
      );
      setNote("");
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message || "Abschluss fehlgeschlagen."),
  });

  if (identity.isLoading || !identity.canManage) return null;

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <CheckCircle2 className="mr-2 h-4 w-4" /> Defekt abschließen
      </Button>
      <Dialog open={open} onOpenChange={(o) => (!mutation.isPending ? setOpen(o) : undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Defekt abschließen</DialogTitle>
            <DialogDescription>{machineName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="close-note">Reparatur- bzw. Prüfvermerk</Label>
              <Textarea
                id="close-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Was wurde repariert oder geprüft?"
              />
            </div>
            <label className="flex items-center gap-3 rounded-md border border-border px-3 py-3">
              <input
                type="checkbox"
                checked={setAvailable}
                onChange={(e) => setSetAvailable(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <span className="text-sm">Gerät wieder freigeben, falls nichts anderes blockiert</span>
            </label>
            <p className="text-xs text-muted-foreground">
              Der Vorgang bleibt in der Historie erhalten. Vermerk, Zeitpunkt und du als
              abschließende Person werden gespeichert.
            </p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="h-11 w-full"
              disabled={note.trim().length < 3 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Abschließen
            </Button>
            <Button
              variant="ghost"
              className="h-10 w-full"
              disabled={mutation.isPending}
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
