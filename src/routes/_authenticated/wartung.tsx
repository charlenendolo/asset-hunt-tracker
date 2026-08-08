import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { maintenanceQuery } from "@/lib/queries";
import { formatCurrency, formatDate, textOrDash } from "@/lib/format";
import { MAINTENANCE_STATUS_LABELS, labelFor } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/wartung")({
  head: () => ({
    meta: [
      { title: "Wartung – AssetHunt" },
      { name: "description", content: "Geplante und abgeschlossene Wartungen der Geräte." },
      { property: "og:title", content: "Wartung – AssetHunt" },
      { property: "og:description", content: "Geplante und abgeschlossene Wartungen der Geräte." },
    ],
  }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const maintenance = useQuery(maintenanceQuery);
  const rows = maintenance.data ?? [];

  return (
    <AppShell title="Wartung" description="Wartungsplanung und Historie">
      {maintenance.isError ? (
        <ErrorState message={(maintenance.error as Error)?.message} />
      ) : maintenance.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-7 w-7" strokeWidth={1.5} />}
          title="Keine Wartungen fällig."
          description="Geplante Wartungen erscheinen hier."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {w.maintenance_type}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {w.machine ? (
                    <Link
                      to="/maschinen/$machineId"
                      params={{ machineId: w.machine.id }}
                      className="hover:text-primary"
                    >
                      {w.machine.name}
                    </Link>
                  ) : (
                    "–"
                  )}{" "}
                  · {formatDate(w.scheduled_date)} · {textOrDash(w.service_provider)} ·{" "}
                  {formatCurrency(w.cost)}
                </p>
              </div>
              <Pill tone="warning">{labelFor(MAINTENANCE_STATUS_LABELS, w.status)}</Pill>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
