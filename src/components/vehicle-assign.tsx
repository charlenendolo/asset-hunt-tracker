import { useMemo, useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
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
import { ROLE_LABELS } from "@/components/role-badge";
import { listVehicleAssignments, setVehicleAssignment } from "@/lib/users.functions";

export type VehicleAssignee = {
  id: string;
  full_name: string | null;
  role: string | null;
  vehicle_site_id: string | null;
};

/** Aktive Benutzer inkl. ihrer Fahrzeugzuordnung — eine gemeinsame Quelle. */
export const vehicleAssignmentsQuery = queryOptions({
  queryKey: ["vehicle-assignments"],
  staleTime: 60 * 1000,
  queryFn: async () => (await listVehicleAssignments()) as VehicleAssignee[],
});

function roleLabel(role: string | null) {
  if (!role) return null;
  return ROLE_LABELS[role] ?? role;
}

export function VehicleAssignDialog({
  site,
  open,
  onOpenChange,
}: {
  site: { id: string; name: string; site_number: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(setVehicleAssignment);
  const people = useQuery(vehicleAssignmentsQuery);
  const [term, setTerm] = useState("");

  const current = (people.data ?? []).find((p) => p.vehicle_site_id === site.id) ?? null;

  const list = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (people.data ?? []).filter((p) =>
      !t ? true : `${p.full_name ?? ""} ${roleLabel(p.role) ?? ""}`.toLowerCase().includes(t),
    );
  }, [people.data, term]);

  const assign = useMutation({
    mutationFn: async (userId: string | null) => save({ data: { siteId: site.id, userId } }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["vehicle-assignments"] }),
        qc.invalidateQueries({ queryKey: ["profiles"] }),
        qc.invalidateQueries({ queryKey: ["profile"] }),
      ]);
      onOpenChange(false);
      toast.success("Zuordnung gespeichert.");
    },
    onError: (e: Error) => toast.error(e.message || "Zuordnung fehlgeschlagen."),
  });

  function choose(person: VehicleAssignee) {
    if (person.id === current?.id) {
      onOpenChange(false);
      return;
    }
    // Ein Benutzer hat höchstens ein Fahrzeug — Wechsel wird bestätigt.
    if (person.vehicle_site_id && person.vehicle_site_id !== site.id) {
      const ok = window.confirm(
        `${person.full_name ?? "Diese Person"} ist aktuell einem anderen Fahrzeug zugeordnet. Zuordnung auf ${site.name} ändern?`,
      );
      if (!ok) return;
    }
    assign.mutate(person.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!assign.isPending ? onOpenChange(o) : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Benutzer zuordnen</DialogTitle>
          <DialogDescription>
            Fahrzeug: {site.name}
            {site.site_number ? ` · ${site.site_number}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9"
            placeholder="Benutzer suchen…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {people.isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">Benutzer werden geladen …</p>
          ) : list.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">Keine Benutzer gefunden.</p>
          ) : (
            list.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={assign.isPending}
                onClick={() => choose(p)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/50"
              >
                <span className="min-w-0 truncate">
                  {p.full_name ?? "Unbenannt"}
                  {roleLabel(p.role) ? (
                    <span className="text-muted-foreground"> · {roleLabel(p.role)}</span>
                  ) : null}
                </span>
                {p.id === current?.id ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            ))
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {current ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={assign.isPending}
              onClick={() => assign.mutate(null)}
            >
              Zuordnung entfernen
            </Button>
          ) : (
            <span />
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={assign.isPending}>
            {assign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VehicleAssignButton({
  assigned,
  onClick,
}: {
  assigned: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
    >
      <UserPlus className="h-3.5 w-3.5" />
      {assigned ? "Zuordnung ändern" : "Benutzer zuordnen"}
    </button>
  );
}
