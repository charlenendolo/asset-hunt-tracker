import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, UserCog } from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(machine.responsible_user_id);
  const [comment, setComment] = useState("");
  const run = useServerFn(reassignMachineResponsibility);

  const people = useMemo(
    () => (profiles.data ?? []).filter((p) => p.active !== false),
    [profiles.data],
  );

  const selectedName =
    selected === null
      ? "Verantwortlichkeit entfernen"
      : (people.find((p) => p.id === selected)?.full_name ??
        machine.responsible?.full_name ??
        "Ohne Namen");


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
            <Label htmlFor="person-select">Verantwortliche Person</Label>
            <Popover open={open} onOpenChange={setOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  id="person-select"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="h-11 w-full justify-between font-normal"
                >
                  <span className="truncate">{selectedName}</span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Person suchen …" />
                  <CommandList>
                    <CommandEmpty>Keine Treffer.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Verantwortlichkeit entfernen"
                        onSelect={() => {
                          setSelected(null);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selected === null ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Verantwortlichkeit entfernen
                      </CommandItem>
                      {people.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.full_name ?? "Ohne Namen"} ${p.id}`}
                          onSelect={() => {
                            setSelected(p.id);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selected === p.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{p.full_name ?? "Ohne Namen"}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
