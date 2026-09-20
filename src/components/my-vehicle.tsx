import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Truck } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/use-profile";
import { machinesBySiteCountQuery, sitesQuery } from "@/lib/queries";
import { formatNumber } from "@/lib/format";

/**
 * „Mein Fahrzeug“ — reine Kontextinformation. Die Geräte im Fahrzeug bleiben
 * „Zugewiesen“; persönliche Obhut entsteht ausschließlich über Ausleihe/Übergabe.
 * Die Anzahl stammt aus derselben Quelle wie die Standortkarten.
 */
export function MyVehicle() {
  const { profile, isLoading } = useCurrentProfile();
  const sites = useQuery(sitesQuery);
  const counts = useQuery(machinesBySiteCountQuery);

  const vehicleId = profile?.vehicle_site_id ?? null;
  if (isLoading || sites.isLoading) {
    return vehicleId || isLoading ? <Skeleton className="h-24 w-full rounded-xl" /> : null;
  }
  if (!vehicleId) return null;

  const vehicle = (sites.data ?? []).find((s) => s.id === vehicleId);
  if (!vehicle) return null;

  const count = counts.data?.[vehicle.id] ?? 0;

  return (
    <section>
      <h2 className="mb-3 text-base font-medium text-foreground">Mein Fahrzeug</h2>
      <Link
        to="/maschinen"
        search={{ siteId: vehicle.id }}
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99]"
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
            {formatNumber(count)}{" "}
            <span className="text-muted-foreground">
              {count === 1 ? "Gerät im Fahrzeug" : "Geräte im Fahrzeug"}
            </span>
          </p>
          {vehicle.active === false ? (
            <p className="mt-1 text-xs text-destructive">
              Dieses Fahrzeug ist inaktiv – bitte in der Benutzerverwaltung anpassen.
            </p>
          ) : null}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      </Link>
    </section>
  );
}
