import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, XCircle } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/hooks/use-identity";
import { cn } from "@/lib/utils";

/**
 * Stornierung setzt reservations.status auf 'cancelled' (bestehender
 * CHECK-Constraint). Es wird nichts gelöscht — die Historie bleibt erhalten.
 * Zugriff regelt die vorhandene RLS-Policy: eigene Reservierung oder Admin.
 */
export function CancelReservationButton({
  reservation,
  className,
  size = "default",
}: {
  reservation: {
    id: string;
    status: string | null;
    reserved_by?: string | null;
    machine?: { name: string } | null;
  };
  className?: string;
  size?: "default" | "sm";
}) {
  const identity = useIdentity();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const isOwner = !!identity.userId && reservation.reserved_by === identity.userId;
  const allowed = identity.isAdmin || isOwner;
  const cancellable = (reservation.status ?? "confirmed").toLowerCase() === "confirmed";

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", reservation.id)
        .eq("status", "confirmed")
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Die Reservierung wurde bereits geändert.");
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["reservations"] }),
        qc.invalidateQueries({ queryKey: ["planner"] }),
        qc.invalidateQueries({ queryKey: ["machine"] }),
      ]);
      toast.success("Reservierung wurde storniert.");
      setOpen(false);
    },
    onError: (error: Error) =>
      toast.error(error.message || "Stornierung konnte nicht durchgeführt werden."),
  });

  if (identity.isLoading || !allowed || !cancellable) return null;

  return (
    <>
      <Button
        variant="ghost"
        className={cn("text-status-defect hover:text-status-defect", className)}
        size={size}
        onClick={() => setOpen(true)}
      >
        <XCircle className="mr-1.5 h-4 w-4" /> Stornieren
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => (!mutation.isPending ? setOpen(o) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reservierung stornieren?</AlertDialogTitle>
            <AlertDialogDescription>
              {reservation.machine?.name ? `${reservation.machine.name}: ` : ""}
              Der Zeitraum wird sofort wieder freigegeben. Die Reservierung bleibt als „Storniert“
              in der Historie sichtbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Zurück</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ja, stornieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
