import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Truck } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/use-profile";
import { machinesBySiteCountQuery, siteMachinesPreviewQuery, sitesQuery } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { machineStatusKey } from "@/lib/status";

const PREVIEW = 5;

/**
 * „Mein Fahrzeug“ — Kontext, keine Obhut. Geräte im Fahrzeug bleiben
 * „Zugewiesen“; Anzahl aus derselben Quelle wie die Standortkarten.
 */
export function MyVehicle() {
  const { profile, isLoading } = useCurrentProfile();
  const sites = useQuery(sitesQuery);
  const counts = useQuery(machinesBySiteCountQuery);
  const vehicleId = profile?.vehicle_site_id ?? null;
  const preview = useQuery(siteMachinesPreviewQuery(vehicleId, PREVIEW));

  if (isLoading || sites.isLoading) {
    return vehicleId || isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : null;
  }
  if (!vehicleId) return null;

  const vehicle = (sites.data ?? []).find((s) => s.id === vehicleId);
  if (!vehicle) return null;

  const count = counts.data?.[vehicle.id] ?? 0;
  const items = preview.data ?? [];
  const more = Math.max(0, count - items.length);

  return (
    <section>
      <h2 className="mb-3 text-base font-medium text-foreground">Mein Fahrzeug</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Link
          to="/maschinen"
          search={{ siteId: vehicle.id }}
          className="flex items-center gap-4 p-5 transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-muted/50">
            <Truck className="h-5 w-5 text-foreground/70" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-foreground">{vehicle.name}</p>
            {vehicle.site_number ? (
              <p className="truncate text-sm text-muted-foreground">{vehicle.site_number}</p>
            ) : null}
            <p className="mt-1 text-sm text-foreground">
              {count === 0 ? (
                <span className="text-muted-foreground">Keine Geräte zugewiesen</span>
              ) : (
                <>
                  {formatNumber(count)}{" "}
                  <span className="text-muted-foreground">{count === 1 ? "Gerät" : "Geräte"}</span>
                </>
              )}
            </p>
            {vehicle.active === false ? (
              <p className="mt-1 text-xs text-destructive">
                Dieses Fahrzeug ist inaktiv – bitte in der Benutzerverwaltung anpassen.
              </p>
            ) : null}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </Link>

        {count > 0 ? (
          <div className="border-t border-border">
            {preview.isLoading ? (
              <div className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((m) => (
                  <li key={m.id}>
                    <Link
                      to="/maschine/$machineId"
                      params={{ machineId: m.id }}
                      className="flex min-h-12 items-center gap-3 px-5 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.asset_code}
                          {machineStatusKey(m.status) === "borrowed" && m.responsible?.full_name
                            ? ` · ${m.responsible.full_name}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge
                        status={m.status}
                        siteType={m.site?.location_type ?? null}
                        responsibleUserId={m.responsible_user_id}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/maschinen"
              search={{ siteId: vehicle.id }}
              className="flex min-h-12 items-center justify-between border-t border-border px-5 py-3 text-sm font-medium text-primary hover:bg-accent/40"
            >
              <span>Alle Geräte anzeigen</span>
              {more > 0 ? (
                <span className="text-xs font-normal text-muted-foreground">+ {more} weitere</span>
              ) : null}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
