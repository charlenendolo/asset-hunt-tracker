import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";

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
import { SiteCombobox } from "@/components/site-combobox";
import { SiteTypeIcon } from "@/components/site-type-icon";
import { useIdentity } from "@/hooks/use-identity";
import { changeMachineSite } from "@/lib/machines.functions";
import { siteTypeLabel } from "@/lib/site-types";
import { cn } from "@/lib/utils";

type SiteMachine = {
  id: string;
  name: string;
  current_site_id: string | null;
  site?: { name?: string | null; location_type?: string | null } | null;
};

/** Standortwechsel — ausschließlich für Administratoren. Obhut bleibt unberührt. */
export function ChangeSiteButton({
  machine,
  className,
}: {
  machine: SiteMachine;
  className?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);

  if (identity.isLoading || !identity.canOperate) return null;

  return (
    <>
      <Button variant="outline" className={cn(className)} onClick={() => setOpen(true)}>
        <MapPin className="mr-2 h-4 w-4" /> Standort ändern
      </Button>
      {open ? <ChangeSiteDialog machine={machine} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ChangeSiteDialog({ machine, onClose }: { machine: SiteMachine; onClose: () => void }) {
  const qc = useQueryClient();
  const run = useServerFn(changeMachineSite);
  const [siteId, setSiteId] = useState(machine.current_site_id ?? "");
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: async () =>
      run({
        data: {
          machineId: machine.id,
          siteId: siteId || null,
          comment: comment.trim() || null,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["machine", machine.id] }),
        qc.invalidateQueries({ queryKey: ["machines"] }),
        qc.invalidateQueries({ queryKey: ["machine-history", machine.id] }),
        qc.invalidateQueries({ queryKey: ["movements"] }),
        qc.invalidateQueries({ queryKey: ["sites"] }),
      ]);
      toast.success("Standort wurde geändert.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Änderung fehlgeschlagen."),
  });

  const unchanged = (siteId || null) === (machine.current_site_id ?? null);

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Standort ändern</DialogTitle>
          <DialogDescription>{machine.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="text-muted-foreground">Aktueller Standort</p>
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {machine.site?.location_type ? (
                <SiteTypeIcon type={machine.site.location_type} withTitle={false} />
              ) : null}
              {machine.site?.name ?? "Kein Standort hinterlegt"}
              {machine.site?.location_type ? (
                <span className="text-xs font-normal text-muted-foreground">
                  · {siteTypeLabel(machine.site.location_type)}
                </span>
              ) : null}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-site">Neuer Standort</Label>
            <SiteCombobox id="new-site" value={siteId} onChange={setSiteId} className="h-11" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-change-comment">Grund / Kommentar (optional)</Label>
            <Textarea
              id="site-change-comment"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="z. B. Umsetzung auf neue Baustelle"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Nur der Standort ändert sich. Obhut, Ausleihe, Defekt- und Wartungsstatus bleiben
            unverändert; die Änderung wird als Bewegung „Umsetzung“ protokolliert.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="h-11 w-full"
            disabled={mutation.isPending || unchanged}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Standort speichern
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
