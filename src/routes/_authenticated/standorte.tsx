import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { CreateSiteDialog, EditSiteDialog } from "@/components/site-combobox";
import { Pill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { machinesBySiteCountQuery, sitesQuery } from "@/lib/queries";
import { SITE_TYPE_LABELS, SITE_TYPE_ORDER, siteTypeLabel } from "@/lib/site-types";
import { SiteTypeIcon } from "@/components/site-type-icon";
import { formatNumber, textOrDash } from "@/lib/format";

type SiteRow = {
  id: string;
  name: string;
  site_number: string | null;
  address: string | null;
  active: boolean;
  location_type: string;
};

export const Route = createFileRoute("/_authenticated/standorte")({
  head: () => ({
    meta: [
      { title: "Standorte – Repenning Geräteportal" },
      {
        name: "description",
        content: "Alle Standorte wie Baustellen, Lager und Werkstätten mit Gerätebestand.",
      },
      { property: "og:title", content: "Standorte – Repenning Geräteportal" },
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
  const [editSite, setEditSite] = useState<SiteRow | null>(null);
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
          {visible.map((s) => {
            const body = (
              <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted/50">
                    <SiteTypeIcon type={s.location_type} className="h-4.5 w-4.5 text-foreground/70" />
                  </span>
                  <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {textOrDash(s.site_number)}
                  </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Pill tone="neutral">{siteTypeLabel(s.location_type)}</Pill>
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
              </>
            );
            const cardClass =
              "block rounded-xl border border-border bg-card p-5" +
              (identity.canManage
                ? " cursor-pointer transition-colors hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99]"
                : "");
            return (
              <li key={s.id} className="relative">
                {identity.canManage ? (
                  <Link to="/maschinen" search={{ siteId: s.id }} className={cardClass}>
                    {body}
                  </Link>
                ) : (
                  <div className={cardClass}>{body}</div>
                )}
                {identity.canManage ? (
                  <button
                    type="button"
                    aria-label={`Standort ${s.name} bearbeiten`}
                    onClick={() => setEditSite(s as SiteRow)}
                    className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {identity.canManage ? (
        <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />
      ) : null}

      {identity.canManage && editSite ? (
        <EditSiteDialog
          site={editSite}
          open={!!editSite}
          onOpenChange={(o) => (!o ? setEditSite(null) : undefined)}
        />
      ) : null}
    </AppShell>
  );
}
