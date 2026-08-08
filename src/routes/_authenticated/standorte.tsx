import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { machinesByeSiteCountQuery, sitesQuery } from "@/lib/queries";
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
  const counts = useQuery(machinesByeSiteCountQuery);

  return (
    <AppShell
      title="Standorte"
      description="Baustellen, Lager und Werkstätten im Überblick"
    >
      {sites.isError ? (
        <ErrorState message={(sites.error as Error)?.message} />
      ) : sites.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (sites.data ?? []).length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-7 w-7" strokeWidth={1.5} />}
          title="Noch keine Standorte vorhanden."
          description="Sobald Standorte angelegt sind, erscheinen sie hier."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sites.data!.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {textOrDash(s.site_number)}
                  </p>
                </div>
                <Pill tone={s.active ? "success" : "neutral"}>
                  {s.active ? "Aktiv" : "Inaktiv"}
                </Pill>
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
    </AppShell>
  );
}
