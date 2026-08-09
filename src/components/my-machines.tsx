import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, PackageOpen } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { usePrimaryPhotos } from "@/hooks/use-primary-photos";
import { myMachinesQuery } from "@/lib/queries";
import { formatExpectedReturn, textOrDash } from "@/lib/format";

/**
 * Personal equipment list — driven solely by machines.responsible_user_id,
 * so it stays in sync with the checkout/return server functions.
 */
export function MyMachines({ heading = true }: { heading?: boolean }) {
  const identity = useIdentity();
  const machines = useQuery(myMachinesQuery(identity.userId));
  const photoUrls = usePrimaryPhotos((machines.data ?? []).map((m) => m.id));

  return (
    <section>
      {heading ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-foreground">Meine Geräte</h2>
          {machines.data?.length ? (
            <span className="text-xs text-muted-foreground">{machines.data.length} zugewiesen</span>
          ) : null}
        </div>
      ) : null}

      {identity.isLoading || machines.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : machines.isError ? (
        <ErrorState message={(machines.error as Error)?.message} />
      ) : (machines.data ?? []).length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-6 w-6" strokeWidth={1.5} />}
          title="Du hast aktuell keine Geräte ausgeliehen."
          description="Scanne den QR-Code an einem Gerät, um es dir zuzuweisen."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(machines.data ?? []).map((m) => (
            <li key={m.id}>
              <Link
                to="/maschine/$machineId"
                params={{ machineId: m.id }}
                className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-accent/40"
              >
                {photoUrls[m.id] ? (
                  <img
                    src={photoUrls[m.id]}
                    alt={m.name}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <ImageOff className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-base font-medium text-foreground">{m.name}</p>
                    <StatusBadge status={m.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.asset_code}</p>
                  <p className="mt-2 truncate text-sm text-foreground">
                    {textOrDash(m.site?.name)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {textOrDash(m.category?.name)}
                  </p>
                  {formatExpectedReturn(m.expected_return_at) ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Voraussichtlich bis {formatExpectedReturn(m.expected_return_at)}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
