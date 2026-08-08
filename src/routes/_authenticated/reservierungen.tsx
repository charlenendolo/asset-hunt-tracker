import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { allReservationsQuery } from "@/lib/queries";
import { formatDateTime, textOrDash } from "@/lib/format";
import { RESERVATION_STATUS_LABELS, labelFor } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/reservierungen")({
  head: () => ({
    meta: [
      { title: "Reservierungen – AssetHunt" },
      { name: "description", content: "Alle Gerätereservierungen mit Zeitraum, Standort und Status." },
      { property: "og:title", content: "Reservierungen – AssetHunt" },
      {
        property: "og:description",
        content: "Alle Gerätereservierungen mit Zeitraum, Standort und Status.",
      },
    ],
  }),
  component: ReservationsPage,
});

function ReservationsPage() {
  const reservations = useQuery(allReservationsQuery);
  const rows = reservations.data ?? [];

  return (
    <AppShell title="Reservierungen" description="Geplante Gerätenutzung">
      {reservations.isError ? (
        <ErrorState message={(reservations.error as Error)?.message} />
      ) : reservations.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-7 w-7" strokeWidth={1.5} />}
          title="Noch keine Reservierungen vorhanden."
          description="Sobald Geräte reserviert werden, erscheinen sie hier."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
            >
              <div className="min-w-0">
                {r.machine ? (
                  <Link
                    to="/maschinen/$machineId"
                    params={{ machineId: r.machine.id }}
                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {r.machine.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-foreground">–</span>
                )}
                <p className="truncate text-xs text-muted-foreground">
                  {formatDateTime(r.start_at)} – {formatDateTime(r.end_at)} ·{" "}
                  {textOrDash(r.site?.name)} · {textOrDash(r.reserved?.full_name)}
                </p>
              </div>
              <Pill>{labelFor(RESERVATION_STATUS_LABELS, r.status)}</Pill>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
