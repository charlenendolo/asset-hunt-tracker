import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { openDefectsQuery } from "@/lib/queries";
import { formatDateTime, textOrDash } from "@/lib/format";
import { DEFECT_SEVERITY_LABELS, DEFECT_STATUS_LABELS, labelFor } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/defekte")({
  head: () => ({
    meta: [
      { title: "Defekte – AssetHunt" },
      { name: "description", content: "Gemeldete Gerätedefekte mit Schweregrad und Bearbeitungsstand." },
      { property: "og:title", content: "Defekte – AssetHunt" },
      {
        property: "og:description",
        content: "Gemeldete Gerätedefekte mit Schweregrad und Bearbeitungsstand.",
      },
    ],
  }),
  component: DefectsPage,
});

function DefectsPage() {
  const defects = useQuery(openDefectsQuery);
  const rows = defects.data ?? [];

  return (
    <AppShell title="Defekte" description="Gemeldete Schäden und Störungen">
      {defects.isError ? (
        <ErrorState message={(defects.error as Error)?.message} />
      ) : defects.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<TriangleAlert className="h-7 w-7" strokeWidth={1.5} />}
          title="Keine offenen Defekte."
          description="Gemeldete Defekte erscheinen hier."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{d.description}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.machine ? (
                    <Link
                      to="/maschinen/$machineId"
                      params={{ machineId: d.machine.id }}
                      className="hover:text-primary"
                    >
                      {d.machine.name}
                    </Link>
                  ) : (
                    "–"
                  )}{" "}
                  · {textOrDash(d.site?.name)} · {formatDateTime(d.created_at)} ·{" "}
                  {textOrDash(d.reporter?.full_name)}
                </p>
              </div>
              <span className="flex shrink-0 gap-2">
                <Pill tone="danger">{labelFor(DEFECT_SEVERITY_LABELS, d.severity)}</Pill>
                <Pill>{labelFor(DEFECT_STATUS_LABELS, d.status)}</Pill>
              </span>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
