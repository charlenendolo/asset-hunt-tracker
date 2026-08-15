import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CircleCheck,
  Container,
  CalendarClock,
  TriangleAlert,
  Wrench,
  ArrowRight,
  History,
  QrCode,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { MyMachines } from "@/components/my-machines";
import { Pill } from "@/components/status-badge";
import { useCurrentProfile } from "@/hooks/use-profile";
import { useIdentity } from "@/hooks/use-identity";
import {
  machineStatusCountsQuery,
  upcomingReservationsQuery,
  openDefectsQuery,
  maintenanceQuery,
  recentMovementsQuery,
  myReservationsQuery,
  overdueMachinesQuery,
} from "@/lib/queries";
import { OverdueBadge } from "@/components/overdue-badge";
import { overdueLabel } from "@/lib/overdue";
import { formatExpectedReturn } from "@/lib/format";

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
      { title: "Dashboard – Repenning Geräteportal" },
      {
        name: "description",
        content: "Tagesübersicht über Geräte, Reservierungen, Defekte und fällige Wartungen.",
      },
      { property: "og:title", content: "Dashboard – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Tagesübersicht über Geräte, Reservierungen, Defekte und fällige Wartungen.",
      },
    ],
  }),
  component: DashboardPage,
});

/** Branded green welcome band — dashboard only. */
function Hero({
  greeting,
  headline,
  subline,
  children,
}: {
  greeting: string;
  headline: string;
  subline: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground sm:px-7 sm:py-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary-foreground/8"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-primary-foreground/5"
      />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground/70">
          {greeting}
        </p>
        <h2 className="mt-2 text-xl font-light tracking-tight sm:text-2xl">{headline}</h2>
        <p className="mt-1.5 max-w-xl text-sm text-primary-foreground/75">{subline}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: typeof Container | undefined;
  action?: React.ReactNode | undefined;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          {Icon ? (
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
          ) : null}
          {title}
        </h2>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

const KPI_ICONS: Record<string, typeof Container> = {
  available: CircleCheck,
  reserved: CalendarClock,
  borrowed: ArrowRight,
  maintenance: Wrench,
  defect: TriangleAlert,
};

/**
 * KPI-Karten des Dashboards. Die Statusfarbe bestimmt die gesamte Kartenfläche
 * (leicht entsättigte Flächen aus Design-Tokens), „Geräte gesamt“ ist die
 * Jungle-Green-Markenkarte. Bewusst nur hier farbig — Datenflächen bleiben neutral.
 */
const KPI_TONES: Record<string, string> = {
  available:
    "border-kpi-available-border bg-kpi-available-surface text-kpi-available-ink hover:brightness-[0.98]",
  reserved:
    "border-kpi-reserved-border bg-kpi-reserved-surface text-kpi-reserved-ink hover:brightness-[0.98]",
  borrowed:
    "border-kpi-borrowed-border bg-kpi-borrowed-surface text-kpi-borrowed-ink hover:brightness-[0.98]",
  maintenance:
    "border-kpi-maintenance-border bg-kpi-maintenance-surface text-kpi-maintenance-ink hover:brightness-[0.98]",
  defect:
    "border-kpi-defect-border bg-kpi-defect-surface text-kpi-defect-ink hover:brightness-[0.98]",
};

function KpiCard({
  label,
  value,
  toneKey,
  loading,
  accent,
  icon: Icon,
  to,
  search,
}: {
  label: string;
  value: number;
  toneKey?: string | undefined;
  loading?: boolean | undefined;
  accent?: boolean | undefined;
  icon?: typeof Container | undefined;
  to?: string | undefined;
  search?: Record<string, string>;
}) {
  const tone = accent
    ? "border-primary bg-primary text-primary-foreground shadow-sm hover:brightness-110"
    : (toneKey && KPI_TONES[toneKey]) || "border-border bg-card text-foreground hover:bg-accent/40";

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide opacity-80">{label}</p>
        {Icon ? (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
              accent ? "bg-primary-foreground/15" : "bg-current/10"
            }`}
          >
            <Icon className="h-4 w-4 opacity-90" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-16 opacity-40" />
      ) : (
        <p
          className={`mt-2 tracking-tight ${accent ? "text-3xl font-semibold" : "text-2xl font-semibold"}`}
        >
          {formatNumber(value)}
        </p>
      )}
    </>
  );

  const className = `relative block overflow-hidden rounded-xl border px-4 py-4 transition-[filter,background-color,box-shadow] ${tone} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99] active:brightness-[0.96]`;

  if (to) {
    return (
      <Link to={to} {...(search ? { search } : {})} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

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
      <Hero
        greeting="Repenning Geräteportal"
        headline={identity.displayName ? `Hallo ${identity.displayName}` : "Hallo"}
        subline="Hier findest du alles, was dir aktuell zugewiesen ist."
      />

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
  const managerIdentity = useIdentity();
  const overdue = useQuery(
    overdueMachinesQuery(managerIdentity.userId, managerIdentity.canManage),
  );
  const overdueMachines = overdue.data?.machines ?? [];

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

  const greeting = profile?.full_name ? `Guten Tag ${profile.full_name}` : "Guten Tag";

  return (
    <AppShell title="Dashboard" description="Was braucht heute Aufmerksamkeit?">
      <Hero
        greeting="Repenning Geräteportal"
        headline={greeting}
        subline={
          isAdmin
            ? "Unternehmensweiter Überblick über Geräte, Reservierungen und Störungen."
            : "Überblick über deinen Standort und die zugewiesenen Geräte."
        }
      >
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl bg-primary-foreground/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-primary-foreground/65">
              Offene Defekte
            </p>
            <p className="mt-0.5 text-xl font-light">{formatNumber(openDefects.length)}</p>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-primary-foreground/65">
              Fällige Wartungen
            </p>
            <p className="mt-0.5 text-xl font-light">{formatNumber(dueMaintenance.length)}</p>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-primary-foreground/65">
              Anstehende Reservierungen
            </p>
            <p className="mt-0.5 text-xl font-light">
              {formatNumber((reservations.data ?? []).length)}
            </p>
          </div>
        </div>
      </Hero>

      {!isAdmin ? (
        <div className="mb-6">
          <MyMachines />
        </div>
      ) : null}

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Gerätebestand
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Geräte gesamt"
          value={counts.data?.total ?? 0}
          loading={counts.isLoading}
          icon={Container}
          accent
        />
        {MACHINE_STATUS_ORDER.map((key) => (
          <KpiCard
            key={key}
            label={MACHINE_STATUS_LABELS[key]}
            value={byStatus(key)}
            toneKey={key}
            icon={KPI_ICONS[key]}
            loading={counts.isLoading}
          />
        ))}
        <Link
          to="/maschinen"
          search={{ status: "overdue" }}
          className="relative overflow-hidden rounded-xl border border-destructive/40 bg-destructive/12 px-4 py-4 text-destructive transition-[filter,background-color] hover:brightness-[0.97]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide">Überfällig</p>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-destructive/15">
              <TriangleAlert className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
          {overdue.isLoading ? (
            <Skeleton className="mt-2 h-8 w-16 opacity-40" />
          ) : (
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatNumber(overdueMachines.length)}
            </p>
          )}
        </Link>
      </div>

      <OverdueSection
        machines={overdueMachines}
        nextReservation={overdue.data?.nextReservation ?? {}}
        loading={overdue.isLoading}
      />


      <h2 className="mb-3 mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Was braucht heute Aufmerksamkeit?
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Anstehende Reservierungen"
          icon={CalendarClock}
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
          icon={Wrench}
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
          icon={TriangleAlert}
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
          <Card title="Letzte Aktivitäten" icon={History}>
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
                        {labelFor(MOVEMENT_TYPE_LABELS, m.movement_type)} · {m.to_site?.name ?? "–"}{" "}
                        · {formatDateTime(m.created_at)}
                      </p>
                    </div>
                    <Pill>{m.performer?.full_name ?? "System"}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card title="Schnellzugriff" icon={Container}>
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

/**
 * Kompakte Liste der abgeleitet überfälligen Geräte (ausgeliehen +
 * Rückgabefrist überschritten). Kein gespeicherter Status, rein berechnet.
 */
function OverdueSection({
  machines,
  nextReservation,
  loading,
}: {
  machines: Array<{
    id: string;
    name: string;
    asset_code: string;
    expected_return_at?: string | null;
    site?: { name: string } | null;
    responsible?: { full_name: string | null } | null;
  }>;
  nextReservation: Record<string, string>;
  loading?: boolean;
}) {
  return (
    <section id="ueberfaellig" className="mt-8">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Überfällige Geräte
      </h2>
      {loading ? (
        <ListSkeleton />
      ) : machines.length === 0 ? (
        <EmptyState
          icon={<CircleCheck className="h-6 w-6" strokeWidth={1.5} />}
          title="Keine überfälligen Geräte."
        />
      ) : (
        <ul className="divide-y divide-destructive/20 overflow-hidden rounded-xl border border-destructive/30 bg-destructive/5">
          {machines.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <Link
                to="/maschinen/$machineId"
                params={{ machineId: m.id }}
                className="flex flex-wrap items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.name} <span className="text-muted-foreground">· {m.asset_code}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Verantwortlich: {m.responsible?.full_name ?? "–"} · Standort:{" "}
                    {m.site?.name ?? "–"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Rückgabe erwartet: {formatExpectedReturn(m.expected_return_at) ?? "–"}
                    {nextReservation[m.id]
                      ? ` · nächste Reservierung ab ${formatDate(nextReservation[m.id])}`
                      : ""}
                  </p>
                </div>
                <span className="flex flex-col items-end gap-1">
                  <OverdueBadge expectedReturnAt={m.expected_return_at} variant="full" />
                  <span className="sr-only">{overdueLabel(m.expected_return_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
