import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, LogOut, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIdentity } from "@/hooks/use-identity";
import { checkoutMachine, returnMachine } from "@/lib/machine-actions.functions";
import { machineRelationsQuery, sitesQuery } from "@/lib/queries";
import { machineStatusKey } from "@/lib/status";

type MachineLike = {
  id: string;
  name: string;
  asset_code: string;
  status: string | null;
  current_site_id: string | null;
  responsible_user_id: string | null;
};

const CONDITIONS = [
  { value: "good", label: "In Ordnung" },
  { value: "incomplete", label: "Unvollständig / kleiner Mangel" },
  { value: "damaged", label: "Beschädigt" },
];

function useRefresh(machineId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["machine", machineId] }),
      qc.invalidateQueries({ queryKey: ["machines"] }),
      qc.invalidateQueries({ queryKey: ["movements"] }),
    ]);
}

export function MachineActions({
  machine,
  className,
}: {
  machine: MachineLike;
  className?: string | undefined;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState<"checkout" | "return" | null>(null);

  const statusKey = machineStatusKey(machine.status);
  const isResponsible = !!identity.userId && machine.responsible_user_id === identity.userId;

  if (identity.isLoading) return null;

  return (
    <div className={className}>
      {statusKey === "available" ? (
        <Button className="h-12 w-full text-base" onClick={() => setOpen("checkout")}>
          <LogOut className="mr-2 h-4 w-4" /> Gerät ausleihen
        </Button>
      ) : null}

      {statusKey === "borrowed" && (isResponsible || identity.canManage) ? (
        <Button className="h-12 w-full text-base" onClick={() => setOpen("return")}>
          <RotateCcw className="mr-2 h-4 w-4" /> Gerät zurückgeben
        </Button>
      ) : null}

      {statusKey === "borrowed" && !isResponsible && !identity.canManage ? (
        <p className="rounded-lg border border-status-borrowed/25 bg-status-borrowed/8 px-4 py-3 text-sm text-status-borrowed">
          Dieses Gerät ist derzeit ausgeliehen.
        </p>
      ) : null}

      {statusKey === "maintenance" ? (
        <p className="rounded-lg border border-status-maintenance/25 bg-status-maintenance/8 px-4 py-3 text-sm text-status-maintenance">
          Gerät befindet sich in Wartung.
        </p>
      ) : null}

      {statusKey === "defect" ? (
        <p className="rounded-lg border border-status-defect/25 bg-status-defect/8 px-4 py-3 text-sm text-status-defect">
          Gerät ist als defekt gemeldet.
        </p>
      ) : null}

      {statusKey === "reserved" ? (
        <p className="rounded-lg border border-status-reserved/25 bg-status-reserved/8 px-4 py-3 text-sm text-status-reserved">
          Dieses Gerät ist reserviert. Bitte Reservierungen prüfen.
        </p>
      ) : null}

      <ActionDialog
        mode={open}
        machine={machine}
        onClose={() => setOpen(null)}
        actorName={identity.displayName}
      />
    </div>
  );
}

function ActionDialog({
  mode,
  machine,
  onClose,
  actorName,
}: {
  mode: "checkout" | "return" | null;
  machine: MachineLike;
  onClose: () => void;
  actorName: string;
}) {
  const relations = useQuery({ ...machineRelationsQuery(machine.id), enabled: !!mode });
  const sites = useQuery({ ...sitesQuery, enabled: !!mode });
  const refresh = useRefresh(machine.id);

  const [siteId, setSiteId] = useState<string>(machine.current_site_id ?? "");
  const [complete, setComplete] = useState(true);
  const [condition, setCondition] = useState("good");
  const [comment, setComment] = useState("");

  const doCheckout = useServerFn(checkoutMachine);
  const doReturn = useServerFn(returnMachine);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        machineId: machine.id,
        siteId: siteId || null,
        equipmentComplete: complete,
        condition: mode === "return" ? condition : null,
        comment: comment.trim() || null,
      };
      if (mode === "checkout") return doCheckout({ data: payload });
      return doReturn({ data: payload });
    },
    onSuccess: async () => {
      await refresh();
      toast.success(
        mode === "checkout" ? "Gerät erfolgreich ausgeliehen." : "Gerät erfolgreich zurückgegeben.",
      );
      setComment("");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Vorgang fehlgeschlagen. Bitte erneut versuchen.");
    },
  });

  const accessories = relations.data?.accessories ?? [];
  const commentRequired = mode === "return" && (!complete || condition !== "good");
  const blocked = commentRequired && !comment.trim();

  return (
    <Dialog open={!!mode} onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "checkout" ? "Gerät ausleihen" : "Gerät zurückgeben"}
          </DialogTitle>
          <DialogDescription>
            {machine.name} · {machine.asset_code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Mitarbeiter</p>
            <p className="font-medium text-foreground">{actorName}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site">
              {mode === "checkout" ? "Standort" : "Rückgabe-Standort"}
            </Label>
            <select
              id="site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Kein Standort</option>
              {(sites.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Zubehör</Label>
            {accessories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Zubehör hinterlegt.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {accessories.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">{a.name}</span>
                    <span className="text-muted-foreground">{a.quantity}×</span>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-3 rounded-md border border-border px-3 py-3">
              <Checkbox
                checked={complete}
                onCheckedChange={(v) => setComplete(v === true)}
                className="h-5 w-5"
              />
              <span className="text-sm font-medium">Zubehör vollständig übernommen</span>
            </label>
          </div>

          {mode === "return" ? (
            <div className="space-y-1.5">
              <Label htmlFor="condition">Zustand</Label>
              <select
                id="condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="comment">
              Kommentar {commentRequired ? "(erforderlich)" : "(optional)"}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={
                commentRequired
                  ? "Bitte fehlendes Zubehör oder Mangel beschreiben."
                  : "Notiz zur Bewegung"
              }
            />
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            className="h-12 w-full text-base"
            disabled={mutation.isPending || blocked}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "checkout" ? "Ausleihe bestätigen" : "Rückgabe bestätigen"}
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
