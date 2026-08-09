import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { CreateSiteDialog } from "@/components/site-combobox";
import { Pill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { machinesBySiteCountQuery, sitesQuery } from "@/lib/queries";
import { SITE_TYPE_LABELS, SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/site-types";
import { formatNumber, textOrDash } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/standorte")({
  head: () => ({
    meta: [
      { title: "Standorte – AssetHunt" },
      {
        name: "description",
        content: "Alle Standorte wie Baustellen, Lager und Werkstätten mit Gerätebestand.",
      },
      { property: "og:title", content: "Standorte – AssetHunt" },
      {
        property: "og:description",
        content: "Alle Standorte wie Baustellen, Lager und Werkstätten mit Gerätebestand.",
      },
    ],
  }),
  component: SitesPage,
});

function SitesPage() {
  const sites = useQuery(sitesQuery);
  const counts = useQuery(machinesBySiteCountQuery);
  const identity = useIdentity();
  const [createOpen, setCreateOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");

  const visible = (sites.data ?? []).filter(
    (s) => !typeFilter || s.location_type === typeFilter,
  );

  return (
    <AppShell
      title="Standorte"
      description="Baustellen, Fahrzeuge, Lager und Werkstätten im Überblick"
      actions={
        identity.canManage ? (
          <Button className="h-10 font-medium" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Neuen Standort hinzufügen</span>
          </Button>
        ) : null
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter("")}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            typeFilter === ""
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-accent/40"
          }`}
        >
          Alle Typen
        </button>
        {SITE_TYPE_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              typeFilter === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent/40"
            }`}
          >
            {SITE_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {sites.isError ? (
        <ErrorState message={(sites.error as Error)?.message} />
      ) : sites.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-7 w-7" strokeWidth={1.5} />}
          title="Keine Standorte für diese Auswahl."
          description="Lege einen neuen Standort an oder wähle einen anderen Typ."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {textOrDash(s.site_number)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Pill tone="primary">{siteTypeLabel(s.location_type)}</Pill>
                  <Pill tone={s.active ? "success" : "neutral"}>
                    {s.active ? "Aktiv" : "Inaktiv"}
                  </Pill>
                </div>
              </div>

              <p className="mt-3 truncate text-sm text-muted-foreground">
                {textOrDash(s.address)}
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">
                {formatNumber(counts.data?.[s.id] ?? 0)}{" "}
                <span className="font-normal text-muted-foreground">Geräte vor Ort</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {identity.canManage ? (
        <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />
      ) : null}
    </AppShell>
  );
}
