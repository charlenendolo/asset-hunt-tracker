import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";

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
import { deleteMachine, getMachineDeletionCheck, setMachineActive } from "@/lib/machines.functions";

type LifecycleMachine = {
  id: string;
  name: string;
  asset_code: string;
  active: boolean | null;
};

function useRefreshLists(machineId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["machine", machineId] }),
      qc.invalidateQueries({ queryKey: ["machines"] }),
      qc.invalidateQueries({ queryKey: ["movements"] }),
    ]);
}

/**
 * Deaktivieren / Reaktivieren / Löschen — ausschließlich für Administratoren.
 * Die Sichtbarkeit hier ist reine Bedienführung; die verbindliche Prüfung
 * erfolgt serverseitig in machines.functions.ts.
 */
export function MachineLifecycleActions({
  machine,
  className,
}: {
  machine: LifecycleMachine;
  className?: string;
}) {
  const identity = useIdentity();
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);
  const isActive = machine.active !== false;

  if (identity.isLoading || !identity.isAdmin) return null;

  return (
    <div className={className}>
      {isActive ? (
        <Button variant="outline" className="w-full" onClick={() => setDialog("archive")}>
          <Archive className="h-4 w-4" />
          <span className="ml-1.5">Gerät deaktivieren</span>
        </Button>
      ) : (
        <ReactivateButton machine={machine} />
      )}

      <Button
        variant="outline"
        className="mt-3 w-full text-destructive hover:text-destructive"
        onClick={() => setDialog("delete")}
      >
        <Trash2 className="h-4 w-4" />
        <span className="ml-1.5">Gerät löschen</span>
      </Button>

      {dialog === "archive" ? (
        <ArchiveDialog machine={machine} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "delete" ? (
        <DeleteDialog machine={machine} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function ReactivateButton({ machine }: { machine: LifecycleMachine }) {
  const refresh = useRefreshLists(machine.id);
  const run = useServerFn(setMachineActive);
  const mutation = useMutation({
    mutationFn: () => run({ data: { machineId: machine.id, active: true, comment: null } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Gerät wurde reaktiviert.");
    },
    onError: (error: Error) => toast.error(error.message || "Vorgang fehlgeschlagen."),
  });

  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArchiveRestore className="h-4 w-4" />
      )}
      <span className="ml-1.5">Gerät aktivieren</span>
    </Button>
  );
}

function ArchiveDialog({ machine, onClose }: { machine: LifecycleMachine; onClose: () => void }) {
  const refresh = useRefreshLists(machine.id);
  const run = useServerFn(setMachineActive);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      run({ data: { machineId: machine.id, active: false, comment: comment.trim() || null } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Gerät wurde deaktiviert und archiviert.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Vorgang fehlgeschlagen."),
  });

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät deaktivieren?</DialogTitle>
          <DialogDescription>
            {machine.name} · {machine.asset_code}
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Das Gerät verschwindet aus dem aktiven Bestand — zum Beispiel weil es verkauft,
          verschrottet, verloren oder dauerhaft außer Betrieb ist. Die gesamte Historie bleibt
          erhalten und du kannst es jederzeit wieder aktivieren.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="archive-comment">Grund (optional)</Label>
          <Textarea
            id="archive-comment"
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="z. B. verkauft, verschrottet, verloren"
          />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Deaktivieren
          </Button>
          <Button
            variant="ghost"
            className="w-full"
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

function DeleteDialog({ machine, onClose }: { machine: LifecycleMachine; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const checkFn = useServerFn(getMachineDeletionCheck);
  const run = useServerFn(deleteMachine);

  const check = useQuery({
    queryKey: ["machine", machine.id, "deletion-check"],
    queryFn: () => checkFn({ data: { machineId: machine.id } }),
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: () => run({ data: { machineId: machine.id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Gerät wurde gelöscht.");
      onClose();
      void navigate({ to: "/maschinen" });
    },
    onError: (error: Error) => toast.error(error.message || "Löschen fehlgeschlagen."),
  });

  const info = check.data;

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät wirklich löschen?</DialogTitle>
          <DialogDescription>
            {machine.name} · {machine.asset_code}
          </DialogDescription>
        </DialogHeader>

        {check.isLoading ? (
          <p className="text-sm text-muted-foreground">Prüfe Historie …</p>
        ) : check.isError ? (
          <p className="text-sm text-destructive">
            {(check.error as Error)?.message || "Prüfung fehlgeschlagen."}
          </p>
        ) : info && !info.canDelete ? (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Löschen ist hier nicht sinnvoll.</p>
            {info.inCustody ? (
              <p className="text-muted-foreground">
                Das Gerät ist aktuell einem Mitarbeiter zugeordnet. Bitte zuerst die Rückgabe
                erfassen.
              </p>
            ) : null}
            {info.hasHistory ? (
              <p className="text-muted-foreground">
                Es liegen bereits Einträge vor: {info.movements} Bewegungen, {info.handovers}{" "}
                Übergaben, {info.reservations} Reservierungen, {info.defects} Defekte,{" "}
                {info.maintenance} Wartungen. Bitte deaktivieren statt löschen — so bleibt die
                Nachvollziehbarkeit erhalten.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Löschen ist nur für versehentlich angelegte, doppelte oder Test-Einträge gedacht und
            kann nicht rückgängig gemacht werden. Für echte Geräte, die aus dem Bestand gehen, ist
            „Gerät deaktivieren" der sichere Weg.
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            className="w-full"
            disabled={mutation.isPending || check.isLoading || !info?.canDelete}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Endgültig löschen
          </Button>
          <Button
            variant="ghost"
            className="w-full"
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
