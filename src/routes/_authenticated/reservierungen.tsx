import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CancelReservationButton } from "@/components/cancel-reservation";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIdentity } from "@/hooks/use-identity";
import { scopedReservationsQuery } from "@/lib/queries";
import { formatDateTime, textOrDash } from "@/lib/format";
import { RESERVATION_STATUS_LABELS, labelFor } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/reservierungen")({
  head: () => ({
    meta: [
      { title: "Reservierungen – AssetHunt" },
      { name: "description", content: "Gerätereservierungen mit Zeitraum, Standort und Status." },
      { property: "og:title", content: "Reservierungen – AssetHunt" },
      {
        property: "og:description",
        content: "Gerätereservierungen mit Zeitraum, Standort und Status.",
      },
    ],
  }),
  component: ReservationsPage,
});

type Row = {
  id: string;
  start_at: string;
  end_at: string;
  status: string | null;
  reserved_by?: string | null;
  machine: { id: string; name: string; asset_code: string } | null;
  site: { id: string; name: string } | null;
  reserved?: { id: string; full_name: string | null } | null;
};

function bucketOf(r: Row, now: number) {
  const start = new Date(r.start_at).getTime();
  const end = new Date(r.end_at).getTime();
  if (end < now) return "past" as const;
  if (start <= now) return "current" as const;
  return "upcoming" as const;
}

function ReservationList({ rows, showOwner }: { rows: Row[]; showOwner: boolean }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
        >
          <div className="min-w-0">
            {r.machine ? (
              <Link
                to="/maschinen/$machineId"
                params={{ machineId: r.machine.id }}
                className="truncate text-sm font-medium text-foreground hover:text-primary"
              >
                {r.machine.name} · {r.machine.asset_code}
              </Link>
            ) : (
              <span className="text-sm font-medium text-foreground">–</span>
            )}
            <p className="truncate text-xs text-muted-foreground">
              {formatDateTime(r.start_at)} – {formatDateTime(r.end_at)} ·{" "}
              {textOrDash(r.site?.name)}
              {showOwner ? ` · ${textOrDash(r.reserved?.full_name)}` : ""}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            <Pill
              tone={
                (r.status ?? "").toLowerCase() === "cancelled"
                  ? "danger"
                  : (r.status ?? "").toLowerCase() === "confirmed"
                    ? "success"
                    : "neutral"
              }
            >
              {labelFor(RESERVATION_STATUS_LABELS, r.status)}
            </Pill>
            <CancelReservationButton reservation={r} size="sm" className="h-8 px-2 text-xs" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReservationsPage() {
  const identity = useIdentity();
  const reservations = useQuery(scopedReservationsQuery(identity.userId, identity.canManage));
  const rows = (reservations.data ?? []) as Row[];
  const now = Date.now();

  const current = rows.filter((r) => bucketOf(r, now) === "current");
  const upcoming = rows
    .filter((r) => bucketOf(r, now) === "upcoming")
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const past = rows.filter((r) => bucketOf(r, now) === "past");

  const groups: Array<{ title: string; rows: Row[] }> = [
    { title: "Aktuell", rows: current },
    { title: "Demnächst", rows: upcoming },
    { title: "Vergangen", rows: past },
  ];

  return (
    <AppShell
      title={identity.canManage ? "Reservierungen" : "Meine Reservierungen"}
      description={
        identity.canManage ? "Geplante Gerätenutzung" : "Deine geplanten und vergangenen Buchungen"
      }
    >
      <PageHeader
        icon={<CalendarClock className="h-5 w-5" strokeWidth={1.75} />}
        title={identity.canManage ? "Reservierungen" : "Meine Reservierungen"}
        description="Geplante Gerätenutzung. Stornierte Buchungen bleiben in der Historie sichtbar."
      />

      {reservations.isError ? (
        <ErrorState message={(reservations.error as Error)?.message} />
      ) : reservations.isLoading || identity.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-7 w-7" strokeWidth={1.5} />}
          title={
            identity.canManage
              ? "Noch keine Reservierungen vorhanden."
              : "Du hast aktuell keine Reservierungen."
          }
          description="Reserviere ein Gerät direkt auf der Geräteseite."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((g) =>
            g.rows.length === 0 ? null : (
              <section key={g.title}>
                <h2 className="mb-3 text-sm font-medium text-foreground">
                  {g.title}{" "}
                  <span className="text-xs text-muted-foreground">({g.rows.length})</span>
                </h2>
                <ReservationList rows={g.rows} showOwner={identity.canManage} />
              </section>
            ),
          )}
        </div>
      )}
    </AppShell>
  );
}
