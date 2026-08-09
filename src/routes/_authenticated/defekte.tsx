import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, HeaderStat } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CloseDefectButton, ReportDefectButton } from "@/components/defect-dialogs";
import { useIdentity } from "@/hooks/use-identity";
import { defectInconsistenciesQuery, openDefectsQuery } from "@/lib/queries";
import { formatDateTime, textOrDash } from "@/lib/format";
import { DEFECT_SEVERITY_LABELS, DEFECT_STATUS_LABELS, labelFor } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/defekte")({
  head: () => ({
    meta: [
      { title: "Defekte – AssetHunt" },
      {
        name: "description",
        content: "Offene und abgeschlossene Gerätedefekte mit Schweregrad und Bearbeitungsstand.",
      },
      { property: "og:title", content: "Defekte – AssetHunt" },
      {
        property: "og:description",
        content: "Offene und abgeschlossene Gerätedefekte mit Schweregrad und Bearbeitungsstand.",
      },
    ],
  }),
  component: DefectsPage,
});

type Filter = "open" | "closed" | "all";

function severityTone(severity: string | null) {
  return severity === "critical" ? "danger" : severity === "minor" ? "neutral" : "warning";
}

function DefectsPage() {
  const identity = useIdentity();
  const defects = useQuery(openDefectsQuery);
  const inconsistencies = useQuery({
    ...defectInconsistenciesQuery,
    enabled: identity.canManage,
  });
  const [filter, setFilter] = useState<Filter>("open");

  const rows = defects.data ?? [];
  const open = rows.filter((d) => d.status !== "resolved");
  const closed = rows.filter((d) => d.status === "resolved");
  const visible = filter === "open" ? open : filter === "closed" ? closed : rows;
  const mismatches = inconsistencies.data ?? [];

  return (
    <AppShell title="Defekte" description="Gemeldete Schäden und Störungen">
      <PageHeader
        icon={<TriangleAlert className="h-5 w-5" strokeWidth={1.75} />}
        title="Defekte & Störungen"
        description="Offene Vorgänge zuerst — abgeschlossene bleiben in der Historie."
        stats={
          <div className="grid gap-2 sm:grid-cols-3">
            <HeaderStat label="Offen" value={open.length} tone="defect" />
            <HeaderStat label="Abgeschlossen" value={closed.length} tone="available" />
            <HeaderStat
              label="Ohne Vorgang"
              value={identity.canManage ? mismatches.length : "–"}
              tone="reserved"
            />
          </div>
        }
      />

      {identity.canManage && mismatches.length > 0 ? (
        <section className="mb-5 rounded-xl border border-status-reserved/30 bg-status-reserved/8 px-4 py-4">
          <div className="mb-3 flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-status-reserved" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Status defekt, aber kein Defektvorgang vorhanden.
              </p>
              <p className="text-xs text-muted-foreground">
                Es werden keine Daten automatisch ergänzt. Erfasse den Vorgang bewusst, wenn er
                tatsächlich besteht.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {mismatches.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    to="/maschinen/$machineId"
                    params={{ machineId: m.id }}
                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {m.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.asset_code} · {textOrDash(m.site?.name)}
                  </p>
                </div>
                <ReportDefectButton
                  machineId={m.id}
                  machineName={m.name}
                  siteId={m.current_site_id}
                  label="Defekt erfassen"
                  className="h-9"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-4 flex rounded-lg border border-border bg-card p-0.5 sm:w-fit">
        {(
          [
            ["open", `Offen (${open.length})`],
            ["closed", `Abgeschlossen (${closed.length})`],
            ["all", "Alle"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none",
              filter === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {defects.isError ? (
        <ErrorState message={(defects.error as Error)?.message} />
      ) : defects.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<TriangleAlert className="h-7 w-7" strokeWidth={1.5} />}
          title={filter === "open" ? "Keine offenen Defekte." : "Keine Einträge."}
          description="Defekte meldest du direkt auf der Geräteseite."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((d) => (
            <li
              key={d.id}
              className={cn(
                "rounded-xl border bg-card px-4 py-4",
                d.status === "resolved" ? "border-border" : "border-status-defect/25",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {d.machine ? (
                      <Link
                        to="/maschinen/$machineId"
                        params={{ machineId: d.machine.id }}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {d.machine.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-foreground">–</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {textOrDash(d.machine?.asset_code)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line text-foreground">
                    {d.description}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {textOrDash(d.site?.name)} · gemeldet {formatDateTime(d.created_at)} von{" "}
                    {textOrDash(d.reporter?.full_name)}
                    {d.resolved_at
                      ? ` · abgeschlossen ${formatDateTime(d.resolved_at)}${
                          d.resolver?.full_name ? ` von ${d.resolver.full_name}` : ""
                        }`
                      : ""}
                  </p>
                </div>
                <span className="flex shrink-0 flex-wrap gap-2">
                  <Pill tone={severityTone(d.severity)}>
                    {labelFor(DEFECT_SEVERITY_LABELS, d.severity)}
                  </Pill>
                  <Pill tone={d.status === "resolved" ? "success" : "danger"}>
                    {labelFor(DEFECT_STATUS_LABELS, d.status)}
                  </Pill>
                </span>
              </div>
              {d.status !== "resolved" ? (
                <div className="mt-3 flex justify-end">
                  <CloseDefectButton
                    defectId={d.id}
                    machineName={d.machine?.name ?? "Gerät"}
                    className="h-9"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
