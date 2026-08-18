import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, UserCog } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { useIdentity } from "@/hooks/use-identity";
import { profilesQuery } from "@/lib/queries";
import { reassignMachineResponsibility } from "@/lib/machines.functions";
import { cn } from "@/lib/utils";

/**
 * Administrative Korrektur der Verantwortlichkeit.
 * Nur Administratoren; jede Änderung erzeugt einen Eintrag in der
 * Bewegungshistorie (Typ „Zuordnung“).
 */
export function ReassignResponsibleButton({
  machine,
  className,
}: {
  machine: {
    id: string;
    name: string;
    responsible_user_id: string | null;
    responsible?: { full_name: string | null } | null;
  };
  className?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);

  if (identity.isLoading || !identity.isAdmin) return null;

  return (
    <>
      <Button variant="outline" className={cn(className)} onClick={() => setOpen(true)}>
        <UserCog className="mr-2 h-4 w-4" /> Verantwortlichkeit ändern
      </Button>
      {open ? <ReassignDialog machine={machine} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReassignDialog({
  machine,
  onClose,
}: {
  machine: {
    id: string;
    name: string;
    responsible_user_id: string | null;
    responsible?: { full_name: string | null } | null;
  };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const profiles = useQuery(profilesQuery);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(machine.responsible_user_id);
  const [comment, setComment] = useState("");
  const run = useServerFn(reassignMachineResponsibility);

  const people = useMemo(() => {
    const rows = (profiles.data ?? []).filter((p) => p.active !== false);
    const term = search.trim().toLowerCase();
    if (!term) return rows.slice(0, 30);
    return rows.filter((p) => (p.full_name ?? "").toLowerCase().includes(term)).slice(0, 30);
  }, [profiles.data, search]);

  const mutation = useMutation({
    mutationFn: async () =>
      run({
        data: {
          machineId: machine.id,
          responsibleUserId: selected,
          comment: comment.trim() || null,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["machine", machine.id] }),
        qc.invalidateQueries({ queryKey: ["machines"] }),
        qc.invalidateQueries({ queryKey: ["movements"] }),
        qc.invalidateQueries({ queryKey: ["planner"] }),
      ]);
      toast.success("Verantwortlichkeit wurde geändert.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Änderung fehlgeschlagen."),
  });

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verantwortlichkeit ändern</DialogTitle>
          <DialogDescription>{machine.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Aktuell verantwortlich</p>
            <p className="font-medium text-foreground">
              {machine.responsible?.full_name ?? "Niemand zugewiesen"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="person-search">Person suchen</Label>
            <Input
              id="person-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name eingeben"
              className="h-11"
            />
          </div>

          <div
            role="listbox"
            aria-label="Verantwortliche Person"
            className="max-h-56 overflow-y-auto rounded-md border border-border"
          >
            <button
              type="button"
              role="option"
              aria-selected={selected === null}
              onClick={() => setSelected(null)}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                selected === null
                  ? "bg-primary/15 font-semibold text-primary"
                  : "hover:bg-accent/50",
              )}
            >
              Verantwortlichkeit entfernen
              {selected === null ? <Check className="h-4 w-4 shrink-0" /> : null}
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected === p.id}
                onClick={() => setSelected(p.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  selected === p.id
                    ? "bg-primary/15 font-semibold text-primary"
                    : "hover:bg-accent/50",
                )}
              >
                {p.full_name ?? "Ohne Namen"}
                {selected === p.id ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            ))}
            {people.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Keine Treffer.</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reassign-comment">Grund / Kommentar (optional)</Label>
            <Textarea
              id="reassign-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="z. B. Übergabe an neue Baustelle"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Die Änderung wird als Bewegung „Zuordnung“ protokolliert — mit alter und neuer
            Verantwortlichkeit, dir als ausführender Person und Zeitstempel.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="h-11 w-full"
            disabled={mutation.isPending || selected === machine.responsible_user_id}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Änderung speichern
          </Button>
          <Button
            variant="ghost"
            className="h-10 w-full"
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
