import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Container,
  CalendarClock,
  TriangleAlert,
  Wrench,
  ArrowRight,
  History,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { useCurrentProfile } from "@/hooks/use-profile";
import {
  machineStatusCountsQuery,
  upcomingReservationsQuery,
  openDefectsQuery,
  maintenanceQuery,
  recentMovementsQuery,
} from "@/lib/queries";
import {
  MACHINE_STATUS_LABELS,
  MACHINE_STATUS_ORDER,
  machineStatusKey,
  labelFor,
  DEFECT_SEVERITY_LABELS,
  MOVEMENT_TYPE_LABELS,
  MAINTENANCE_STATUS_LABELS,
} from "@/lib/status";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard – AssetHunt" },
      {
        name: "description",
        content: "Tagesübersicht über Geräte, Reservierungen, Defekte und fällige Wartungen.",
      },
      { property: "og:title", content: "Dashboard – AssetHunt" },
      {
        property: "og:description",
        content: "Tagesübersicht über Geräte, Reservierungen, Defekte und fällige Wartungen.",
      },
    ],
  }),
  component: DashboardPage,
});

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone?: string | undefined;
  loading?: boolean | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex items-center gap-2">
        {tone ? <span className={`h-1.5 w-1.5 rounded-full ${tone}`} /> : null}
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1.5 text-2xl font-light tracking-tight text-foreground">
          {formatNumber(value)}
        </p>
      )}
    </div>
  );
}

const STATUS_DOT: Record<string, string> = {
  available: "bg-status-available",
  reserved: "bg-status-reserved",
  borrowed: "bg-status-borrowed",
  maintenance: "bg-status-maintenance",
  defect: "bg-status-defect",
  unknown: "bg-muted-foreground",
};

function DashboardPage() {
  const identity = useIdentity();
  if (identity.isLoading) {
    return (
      <AppShell title="Dashboard">
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }
  return identity.canManage ? <ManagerDashboard /> : <UserDashboard />;
}

/** Field worker view: only personal equipment, no company-wide data. */
function UserDashboard() {
  const identity = useIdentity();
  const reservations = useQuery(myReservationsQuery(identity.userId));

  return (
    <AppShell title="Meine Übersicht" description="Deine Geräte auf einen Blick">
      <p className="mb-5 text-sm text-muted-foreground">
        {identity.displayName ? `Hallo ${identity.displayName}` : "Hallo"}
      </p>

      <MyMachines />

      <section className="mt-8">
        <h2 className="mb-3 text-base font-medium text-foreground">Meine Reservierungen</h2>
        {reservations.isLoading ? (
          <ListSkeleton />
        ) : (reservations.data ?? []).length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" strokeWidth={1.5} />}
            title="Du hast aktuell keine Reservierungen."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
            {(reservations.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.machine?.name ?? "Unbekanntes Gerät"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(r.start_at)} – {formatDateTime(r.end_at)}
                  </p>
                </div>
                <Pill>{r.site?.name ?? "Ohne Standort"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-medium text-foreground">Schnellaktionen</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-4 text-sm text-muted-foreground">
            <QrCode className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>Gerät per QR öffnen – Scanner folgt, nutze bis dahin die Kamera-App.</span>
          </div>
          <Link
            to="/maschinen"
            className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-3">
              <Container className="h-5 w-5" strokeWidth={1.75} /> Meine Geräte
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/reservierungen"
            className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5" strokeWidth={1.75} /> Meine Reservierungen
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </section>
    </AppShell>
  );
}

function ManagerDashboard() {
  const { profile, isAdmin, isLoading: profileLoading } = useCurrentProfile();

  const counts = useQuery(machineStatusCountsQuery());
  const reservations = useQuery(upcomingReservationsQuery);
  const defects = useQuery(openDefectsQuery);
  const maintenance = useQuery(maintenanceQuery);
  const movements = useQuery({ ...recentMovementsQuery, enabled: isAdmin });

  const byStatus = (key: string) => {
    const c = counts.data?.counts ?? {};
    return Object.entries(c).reduce(
      (sum, [raw, n]) => (machineStatusKey(raw) === key ? sum + n : sum),
      0,
    );
  };

  const openDefects = (defects.data ?? []).filter(
    (d) => d.status === "open" || d.status === "in_progress",
  );
  const dueMaintenance = (maintenance.data ?? []).filter(
    (m) => m.status !== "completed" && m.status !== "cancelled",
  );

  const greeting = profile?.full_name ? `Guten Tag, ${profile.full_name}` : "Guten Tag";

  return (
    <AppShell title="Dashboard" description="Was braucht heute Aufmerksamkeit?">
      <p className="mb-5 text-sm text-muted-foreground">{greeting}</p>

      {!isAdmin ? (
        <div className="mb-6">
          <MyMachines />
        </div>
      ) : null}


      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Geräte gesamt"
          value={counts.data?.total ?? 0}
          loading={counts.isLoading}
        />
        {MACHINE_STATUS_ORDER.map((key) => (
          <KpiCard
            key={key}
            label={MACHINE_STATUS_LABELS[key]}
            value={byStatus(key)}
            tone={STATUS_DOT[key]}
            loading={counts.isLoading}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card
          title="Anstehende Reservierungen"
          action={
            <Link
              to="/reservierungen"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              Alle <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {reservations.isLoading ? (
            <ListSkeleton />
          ) : (reservations.data ?? []).length === 0 ? (
            <EmptyState
              className="border-0 py-8"
              icon={<CalendarClock className="h-6 w-6" strokeWidth={1.5} />}
              title="Noch keine Reservierungen vorhanden."
            />
          ) : (
            <ul className="divide-y divide-border">
              {(reservations.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.machine?.name ?? "Unbekanntes Gerät"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(r.start_at)} – {formatDateTime(r.end_at)}
                    </p>
                  </div>
                  <Pill>{r.site?.name ?? "Ohne Standort"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Fällige Wartungen"
          action={
            <Link
              to="/wartung"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              Alle <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {maintenance.isLoading ? (
            <ListSkeleton />
          ) : dueMaintenance.length === 0 ? (
            <EmptyState
              className="border-0 py-8"
              icon={<Wrench className="h-6 w-6" strokeWidth={1.5} />}
              title="Keine Wartungen fällig."
            />
          ) : (
            <ul className="divide-y divide-border">
              {dueMaintenance.slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.machine?.name ?? "Unbekanntes Gerät"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.maintenance_type} · {formatDate(m.scheduled_date)}
                    </p>
                  </div>
                  <Pill tone="warning">{labelFor(MAINTENANCE_STATUS_LABELS, m.status)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Neueste Defekte"
          action={
            <Link
              to="/defekte"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              Alle <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {defects.isLoading ? (
            <ListSkeleton />
          ) : openDefects.length === 0 ? (
            <EmptyState
              className="border-0 py-8"
              icon={<TriangleAlert className="h-6 w-6" strokeWidth={1.5} />}
              title="Keine offenen Defekte."
            />
          ) : (
            <ul className="divide-y divide-border">
              {openDefects.slice(0, 8).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {d.machine?.name ?? "Unbekanntes Gerät"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{d.description}</p>
                  </div>
                  <Pill tone="danger">{labelFor(DEFECT_SEVERITY_LABELS, d.severity)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isAdmin || profileLoading ? (
          <Card title="Letzte Aktivitäten">
            {movements.isLoading ? (
              <ListSkeleton />
            ) : (movements.data ?? []).length === 0 ? (
              <EmptyState
                className="border-0 py-8"
                icon={<History className="h-6 w-6" strokeWidth={1.5} />}
                title="Noch keine Bewegungen erfasst."
              />
            ) : (
              <ul className="divide-y divide-border">
                {(movements.data ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.machine?.name ?? "Unbekanntes Gerät"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {labelFor(MOVEMENT_TYPE_LABELS, m.movement_type)} ·{" "}
                        {m.to_site?.name ?? "–"} · {formatDateTime(m.created_at)}
                      </p>
                    </div>
                    <Pill>{m.performer?.full_name ?? "System"}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card title="Schnellzugriff">
            <Link
              to="/maschinen"
              className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <Container className="h-4 w-4" strokeWidth={1.75} /> Maschinen & Geräte
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              Systemweite Aktivitätsprotokolle sind Administratoren vorbehalten.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
