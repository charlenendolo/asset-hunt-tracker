import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";

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
import { createReservation } from "@/lib/reservations.functions";
import { SiteCombobox } from "@/components/site-combobox";

function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function ReserveMachineButton({
  machine,
  className,
}: {
  machine: { id: string; name: string; asset_code: string; current_site_id: string | null };
  className?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);

  if (identity.isLoading || !identity.userId) return null;

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <CalendarPlus className="mr-2 h-4 w-4" /> Reservieren
      </Button>
      {open ? <ReserveDialog machine={machine} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReserveDialog({
  machine,
  onClose,
}: {
  machine: { id: string; name: string; asset_code: string; current_site_id: string | null };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);

  const [startAt, setStartAt] = useState(localInput(now));
  const [endAt, setEndAt] = useState(localInput(tomorrow));
  const [siteId, setSiteId] = useState(machine.current_site_id ?? "");
  const [notes, setNotes] = useState("");

  const submit = useServerFn(createReservation);

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          machineId: machine.id,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          siteId: siteId || null,
          notes: notes.trim() || null,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["reservations"] }),
        qc.invalidateQueries({ queryKey: ["machine", machine.id] }),
      ]);
      toast.success("Reservierung gespeichert.");
      onClose();
    },
    onError: (error: Error) =>
      toast.error(error.message || "Reservierung fehlgeschlagen. Bitte erneut versuchen."),
  });

  const invalid = !startAt || !endAt || new Date(endAt) <= new Date(startAt);

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerät reservieren</DialogTitle>
          <DialogDescription>
            {machine.name} · {machine.asset_code}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="res-start">Beginn</Label>
            <Input
              id="res-start"
              type="datetime-local"
              className="h-11"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-end">Ende</Label>
            <Input
              id="res-end"
              type="datetime-local"
              className="h-11"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-site">Standort</Label>
            <SiteCombobox id="res-site" value={siteId} onChange={setSiteId} className="h-11" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="res-notes">Kommentar (optional)</Label>
            <Textarea
              id="res-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {invalid ? (
            <p className="text-xs text-status-defect">Das Ende muss nach dem Beginn liegen.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Abbrechen
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={invalid || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Reservieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
