import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pill } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { AccessoryCombobox, useAccessoryCatalog } from "@/components/accessory-picker";
import { useIdentity } from "@/hooks/use-identity";
import { machineRelationsQuery } from "@/lib/queries";
import {
  addMachineAccessories,
  deleteMachineAccessory,
  updateMachineAccessory,
} from "@/lib/accessories.functions";

type Row = { id: string; name: string; quantity: number; required: boolean };

/** Zubehörverwaltung im Gerätepass — Lesen für alle, Pflegen für Admin/Bauleiter. */
export function MachineAccessories({ machineId }: { machineId: string }) {
  const qc = useQueryClient();
  const identity = useIdentity();
  const relations = useQuery(machineRelationsQuery(machineId));
  const catalog = useAccessoryCatalog();
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);

  const add = useServerFn(addMachineAccessories);
  const update = useServerFn(updateMachineAccessory);
  const remove = useServerFn(deleteMachineAccessory);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["machine", machineId, "relations"] }),
      qc.invalidateQueries({ queryKey: ["accessories", "names"] }),
    ]);
  }

  const addMutation = useMutation({
    mutationFn: (name: string) =>
      add({ data: { machineId, items: [{ name, quantity: 1, required: true }] } }),
    onSuccess: async () => {
      await refresh();
      toast.success("Zubehör hinzugefügt.");
    },
    onError: (e: Error) => toast.error(e.message || "Zubehör konnte nicht gespeichert werden."),
  });

  const updateMutation = useMutation({
    mutationFn: (row: Row) =>
      update({ data: { id: row.id, quantity: row.quantity, required: row.required } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message || "Änderung fehlgeschlagen."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: async () => {
      setPendingDelete(null);
      await refresh();
      toast.success("Zubehör entfernt.");
    },
    onError: (e: Error) => toast.error(e.message || "Entfernen fehlgeschlagen."),
  });

  const rows = (relations.data?.accessories ?? []) as Row[];
  const canManage = identity.canManage;

  if (relations.isLoading) return <Skeleton className="h-16 w-full" />;

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyState className="border-0 py-6" title="Kein Zubehör hinterlegt." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.name}</span>
              {canManage ? (
                <>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={a.required}
                      onCheckedChange={(v) => updateMutation.mutate({ ...a, required: v === true })}
                    />
                    Pflicht
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    aria-label={`Menge ${a.name}`}
                    defaultValue={a.quantity}
                    onBlur={(e) => {
                      const quantity = Math.max(1, Number(e.target.value) || 1);
                      if (quantity !== a.quantity) updateMutation.mutate({ ...a, quantity });
                    }}
                    className="h-9 w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${a.name} entfernen`}
                    onClick={() => setPendingDelete(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <span className="flex shrink-0 items-center gap-2">
                  {a.required ? <Pill tone="primary">Pflicht</Pill> : null}
                  <span className="text-sm text-muted-foreground">{a.quantity}×</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="space-y-1.5">
          <AccessoryCombobox
            catalog={catalog}
            onPick={(name) => addMutation.mutate(name)}
            className="h-11"
          />
          {addMutation.isPending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wird gespeichert …
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Bekannte Bezeichnungen auswählen oder neue anlegen.
            </p>
          )}
        </div>
      ) : null}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => (!o ? setPendingDelete(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zubehör entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{pendingDelete?.name}“ wird von diesem Gerät entfernt. Das lässt sich nicht
              rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
