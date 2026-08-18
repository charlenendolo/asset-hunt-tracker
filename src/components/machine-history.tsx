import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CalendarClock,
  ChevronDown,
  MapPin,
  PackageCheck,
  PackageOpen,
  UserCog,
  Wrench,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import { EmptyState, ErrorState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { getMachineHistory, type MachineHistoryEvent } from "@/lib/machine-history.functions";

const PAGE = 25;

const ICONS: Record<MachineHistoryEvent["kind"], React.ComponentType<{ className?: string }>> = {
  checkout: PackageOpen,
  return: PackageCheck,
  assignment: UserCog,
  transfer: ArrowRightLeft,
  defect_reported: AlertTriangle,
  defect_resolved: CheckCircle2,
  maintenance_scheduled: Wrench,
  maintenance_completed: Wrench,
  reservation: CalendarClock,
};

function EventRow({ event }: { event: MachineHistoryEvent }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[event.kind] ?? MapPin;
  const siteChanged =
    (event.fromSite || event.toSite) && event.fromSite !== event.toSite ? true : false;
  const when = event.dateOnly ? formatDate(event.at) : formatDateTime(event.at);

  return (
    <li className="flex gap-3 py-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-muted/40">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{when}</p>
        <p className="text-sm font-medium text-foreground">{event.title}</p>
        {event.subject ? (
          <p className="truncate text-sm text-muted-foreground">{event.subject}</p>
        ) : null}
        {siteChanged ? (
          <p className="truncate text-xs text-muted-foreground">
            {event.fromSite ?? "–"} → {event.toSite ?? "–"}
          </p>
        ) : event.toSite && event.kind === "reservation" ? (
          <p className="truncate text-xs text-muted-foreground">{event.toSite}</p>
        ) : null}
        {event.actor ? (
          <p className="truncate text-xs text-muted-foreground">
            Durchgeführt von: {event.actor}
          </p>
        ) : null}
        {event.detail ? (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open ? "Details ausblenden" : "Details"}
            </button>
            {open ? (
              <p className="mt-1 whitespace-pre-line text-xs text-foreground">{event.detail}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

/** Nur für Administratoren — die Serverfunktion prüft die Rolle erneut. */
export function MachineHistory({ machineId }: { machineId: string }) {
  const [visible, setVisible] = useState(PAGE);
  const history = useQuery({
    queryKey: ["machine", machineId, "history"],
    queryFn: () => getMachineHistory({ data: { machineId } }),
    staleTime: 30 * 1000,
  });

  if (history.isLoading) return <Skeleton className="h-24 w-full" />;
  if (history.isError) return <ErrorState message={(history.error as Error)?.message} />;

  const events = history.data?.events ?? [];
  if (events.length === 0) {
    return <EmptyState className="border-0 py-8" title="Noch kein Verlauf vorhanden." />;
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {events.slice(0, visible).map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </ul>
      {events.length > visible ? (
        <div className="pt-3">
          <Button variant="outline" className="h-9" onClick={() => setVisible((v) => v + PAGE)}>
            Weitere anzeigen
          </Button>
        </div>
      ) : null}
    </div>
  );
}
