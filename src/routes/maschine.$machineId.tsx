import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { MachineActions } from "@/components/machine-actions";
import { ReserveMachineButton } from "@/components/reserve-machine";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { machineDetailQuery, machineRelationsQuery } from "@/lib/queries";
import { formatDateTime, formatExpectedReturn, textOrDash } from "@/lib/format";
import { MOVEMENT_TYPE_LABELS, labelFor } from "@/lib/status";
import { useIdentity } from "@/hooks/use-identity";
import { usePrimaryPhotos } from "@/hooks/use-primary-photos";
import { MachineHeroPhoto } from "@/components/machine-hero-photo";


export const Route = createFileRoute("/maschine/$machineId")({
  // Client-only gate: QR scans often arrive logged out. We keep the scanned
  // machine in ?redirect= so the login lands back on this exact page.
  ssr: false,
  beforeLoad: async ({ params }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: `/maschine/${params.machineId}` } });
    }
  },
  head: () => ({
    meta: [
      { title: "Gerät scannen – AssetHunt" },
      {
        name: "description",
        content: "Gerät per QR-Code öffnen, ausleihen oder zurückgeben.",
      },
      { property: "og:title", content: "Gerät scannen – AssetHunt" },
      {
        property: "og:description",
        content: "Gerät per QR-Code öffnen, ausleihen oder zurückgeben.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QrMachinePage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function QrMachinePage() {
  const { machineId } = Route.useParams();
  const identity = useIdentity();
  const machine = useQuery(machineDetailQuery(machineId));
  const photoUrls = usePrimaryPhotos(machine.data ? [machine.data.id] : [], "full");
  const relations = useQuery(machineRelationsQuery(machineId));

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg bg-background px-4 pb-16 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <Link to="/dashboard" className="text-sm font-medium text-muted-foreground">
          Übersicht
        </Link>
      </header>

      {machine.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : machine.isError ? (
        <ErrorState message={(machine.error as Error)?.message} />
      ) : !machine.data ? (
        <EmptyState
          title="Gerät nicht gefunden."
          description="Die gescannte Kennung gehört zu keinem Gerät."
          action={
            <Link to="/maschinen" className="text-sm font-medium text-primary">
              Zur Geräteliste
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <MachineHeroPhoto src={photoUrls[machine.data.id]} alt={machine.data.name} />

            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-light text-foreground">
                    {machine.data.name}
                  </h1>
                  <p className="text-sm text-muted-foreground">{machine.data.asset_code}</p>
                </div>
                <StatusBadge status={machine.data.status} />
              </div>
              <div className="mt-3 divide-y divide-border border-t border-border">
                <Row label="Standort" value={textOrDash(machine.data.site?.name)} />
                <Row label="Verantwortlich" value={textOrDash(machine.data.responsible?.full_name)} />
                <Row label="Kategorie" value={textOrDash(machine.data.category?.name)} />
                {formatExpectedReturn(machine.data.expected_return_at) ? (
                  <Row
                    label="Voraussichtlich bis"
                    value={formatExpectedReturn(machine.data.expected_return_at)!}
                  />
                ) : null}
              </div>
            </div>
          </section>

          <MachineActions
            className="space-y-3"
            machine={{
              id: machine.data.id,
              name: machine.data.name,
              asset_code: machine.data.asset_code,
              status: machine.data.status,
              current_site_id: machine.data.current_site_id,
              responsible_user_id: machine.data.responsible_user_id,
            }}
          />

          <ReserveMachineButton
            className="w-full"
            machine={{
              id: machine.data.id,
              name: machine.data.name,
              asset_code: machine.data.asset_code,
              current_site_id: machine.data.current_site_id,
            }}
          />

          <section className="rounded-xl border border-border bg-card px-5 py-4">
            <h2 className="mb-2 text-sm font-medium text-foreground">Letzte Bewegungen</h2>
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (relations.data?.movements.length ?? 0) === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Noch keine Bewegungen erfasst.</p>
            ) : (
              <ul className="divide-y divide-border">
                {relations.data!.movements.slice(0, 5).map((mv) => (
                  <li key={mv.id} className="py-2.5">
                    <p className="text-sm font-medium text-foreground">
                      {labelFor(MOVEMENT_TYPE_LABELS, mv.movement_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(mv.created_at)} · {textOrDash(mv.performer?.full_name)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {identity.canManage ? (
            <Link
              to="/maschinen/$machineId"
              params={{ machineId }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              Vollständigen Gerätepass öffnen <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      )}
    </main>
  );
}
