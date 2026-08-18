import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Wrench,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calendarQuery } from "@/lib/queries";
import { useIdentity } from "@/hooks/use-identity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({
    meta: [
      { title: "Kalender – Repenning Geräteportal" },
      {
        name: "description",
        content: "Geplante Reservierungen, anstehende Wartungen und Prüfungen aller Geräte.",
      },
      { property: "og:title", content: "Kalender – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Geplante Reservierungen, anstehende Wartungen und Prüfungen aller Geräte.",
      },
    ],
  }),
  component: CalendarPage,
});

/* ------------------------------------------------------------------ Helpers */

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr"];
const WEEKDAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long" });
const shortFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const c = startOfDay(d);
  c.setDate(c.getDate() + n);
  return c;
}
function startOfWeek(d: Date) {
  return addDays(d, -((d.getDay() + 6) % 7));
}
function isoDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Datumsangaben (date-Spalten) ohne Zeitzonenverschiebung interpretieren. */
function fromDateOnly(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

type EventKind = "reservation" | "maintenance" | "inspection";

type CalendarEvent = {
  id: string;
  machineId: string;
  kind: EventKind;
  start: number;
  end: number;
  /** Gerätename */
  title: string;
  assetCode: string | null;
  detail: string;
  rangeLabel: string;
};

const KIND_STYLES: Record<
  EventKind,
  { bar: string; dot: string; label: string; icon: typeof Wrench }
> = {
  reservation: {
    bar: "bg-status-reserved/18 text-status-reserved ring-1 ring-inset ring-status-reserved/25 hover:bg-status-reserved/28",
    dot: "bg-status-reserved",
    label: "Reservierung",
    icon: CalendarRange,
  },
  maintenance: {
    bar: "bg-status-maintenance/18 text-status-maintenance ring-1 ring-inset ring-status-maintenance/25 hover:bg-status-maintenance/28",
    dot: "bg-status-maintenance",
    label: "Wartung",
    icon: Wrench,
  },
  inspection: {
    bar: "bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 hover:bg-primary/20",
    dot: "bg-primary",
    label: "Prüfung",
    icon: BadgeCheck,
  },
};

/* --------------------------------------------------------------------- Page */

type View = "day" | "week" | "month";

function rangeFor(view: View, cursor: Date) {
  if (view === "day") return { from: startOfDay(cursor), to: startOfDay(cursor) };
  if (view === "week") {
    const start = startOfWeek(cursor);
    return { from: start, to: addDays(start, 6) };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return { from: gridStart, to: addDays(gridStart, 41) };
}

function CalendarPage() {
  const identity = useIdentity();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  const range = rangeFor(view, cursor);
  const calendar = useQuery(
    calendarQuery(identity.userId, identity.canManage, isoDate(range.from), isoDate(range.to)),
  );

  const data = calendar.data;

  const events = useMemo<CalendarEvent[]>(() => {
    if (!data) return [];
    const list: CalendarEvent[] = [];

    for (const r of data.reservations) {
      const start = startOfDay(new Date(r.start_at));
      const end = startOfDay(new Date(r.end_at));
      list.push({
        id: `res-${r.id}`,
        machineId: r.machine_id,
        kind: "reservation",
        start: start.getTime(),
        end: Math.max(start.getTime(), end.getTime()),
        title: r.machine?.name ?? "Gerät",
        assetCode: r.machine?.asset_code ?? null,
        detail: [r.reserved?.full_name, r.site?.name].filter(Boolean).join(" · "),
        rangeLabel: `${dateFmt.format(start)} – ${dateFmt.format(end)}`,
      });
    }

    for (const w of data.maintenance) {
      if (!w.scheduled_date) continue;
      const day = fromDateOnly(w.scheduled_date);
      list.push({
        id: `mnt-${w.id}`,
        machineId: w.machine_id,
        kind: "maintenance",
        start: day.getTime(),
        end: day.getTime(),
        title: w.machine?.name ?? "Gerät",
        assetCode: w.machine?.asset_code ?? null,
        detail: [w.maintenance_type, w.service_provider].filter(Boolean).join(" · "),
        rangeLabel: dateFmt.format(day),
      });
    }

    for (const m of data.inspections) {
      if (!m.next_inspection_date) continue;
      const day = fromDateOnly(m.next_inspection_date);
      list.push({
        id: `insp-${m.id}`,
        machineId: m.id,
        kind: "inspection",
        start: day.getTime(),
        end: day.getTime(),
        title: m.name,
        assetCode: m.asset_code,
        detail: "Fällige Prüfung",
        rangeLabel: dateFmt.format(day),
      });
    }

    return list.sort((a, b) => a.start - b.start);
  }, [data]);

  function eventsOn(day: Date) {
    const time = startOfDay(day).getTime();
    return events.filter((e) => e.start <= time && e.end >= time);
  }

  function step(direction: number) {
    setCursor((c) =>
      view === "day"
        ? addDays(c, direction)
        : view === "week"
          ? addDays(c, direction * 7)
          : new Date(c.getFullYear(), c.getMonth() + direction, 1),
    );
  }

  const rangeLabel =
    view === "day"
      ? dayFmt.format(cursor)
      : view === "week"
        ? `${shortFmt.format(startOfWeek(cursor))} – ${shortFmt.format(addDays(startOfWeek(cursor), 4))}`
        : monthFmt.format(cursor);

  return (
    <AppShell title="Kalender" description="Reservierungen, Wartungen und Prüfungen">
      <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border/70 bg-muted/30 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Kalender</h1>
              <p className="text-sm text-muted-foreground">
                Geplante Reservierungen, anstehende Wartungen und Prüfungen.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-background p-0.5">
              {(
                [
                  ["day", "Tag"],
                  ["week", "Woche"],
                  ["month", "Monat"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    view === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setCursor(startOfDay(new Date()))}
            >
              Heute
            </Button>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" aria-label="Zurück" onClick={() => step(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Weiter" onClick={() => step(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <h2 className="text-base font-semibold capitalize text-foreground">{rangeLabel}</h2>
          <Legend />
        </div>
      </section>

      {calendar.isError ? (
        <ErrorState message={(calendar.error as Error)?.message} />
      ) : calendar.isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : view === "day" ? (
        <AgendaView days={[cursor]} eventsOn={eventsOn} />
      ) : view === "week" ? (
        <AgendaView
          days={Array.from({ length: 5 }, (_, i) => addDays(startOfWeek(cursor), i))}
          eventsOn={eventsOn}
        />
      ) : (
        <MonthView
          cursor={cursor}
          events={events}
          onPickDay={(d) => {
            setCursor(d);
            setView("day");
          }}
        />
      )}
    </AppShell>
  );
}

function Legend() {
  const items: Array<[string, string]> = [
    ["bg-status-reserved", "Reservierung"],
    ["bg-status-maintenance", "Wartung"],
    ["bg-primary", "Prüfung"],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map(([dot, label]) => (
        <li key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Kompakter Termin-Balken. */
function EventBar({
  event,
  label,
  className,
}: {
  event: CalendarEvent;
  label: string;
  className?: string;
}) {
  const style = KIND_STYLES[event.kind];
  const Icon = style.icon;
  return (
    <span
      title={`${style.label}: ${event.title}${event.detail ? " – " + event.detail : ""}`}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
        style.bar,
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Termin-Zeile mit Sprung in den Gerätepass. */
function EventRow({ event }: { event: CalendarEvent }) {
  const style = KIND_STYLES[event.kind];
  const Icon = style.icon;
  return (
    <li>
      <Link
        to="/maschinen/$machineId"
        params={{ machineId: event.machineId }}
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-muted/40">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {style.label} – {event.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {[event.assetCode, event.rangeLabel, event.detail].filter(Boolean).join(" · ")}
            </span>
          </span>
        </span>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
      </Link>
    </li>
  );
}

/* ------------------------------------------------------- Tages-/Wochenliste */

function AgendaView({
  days,
  eventsOn,
}: {
  days: Date[];
  eventsOn: (d: Date) => CalendarEvent[];
}) {
  const sections = days
    .map((d) => ({ day: d, events: eventsOn(d) }))
    .filter((s) => s.events.length > 0);

  if (sections.length === 0) {
    return <EmptyState title="Keine geplanten Termine in diesem Zeitraum." />;
  }

  return (
    <div className="space-y-4">
      {sections.map(({ day, events }) => (
        <section
          key={day.toISOString()}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <header className="flex items-center gap-2 border-b border-border/70 bg-muted/30 px-5 py-3">
            <h3 className="text-sm font-semibold capitalize text-foreground">
              {dayFmt.format(day)}
            </h3>
            <span className="text-xs text-muted-foreground">({events.length})</span>
          </header>
          <ul className="divide-y divide-border/60">
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- Month view */

function MonthView({
  cursor,
  events,
  onPickDay,
}: {
  cursor: Date;
  events: CalendarEvent[];
  onPickDay: (d: Date) => void;
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 5 }, (_, day) => addDays(gridStart, week * 7 + day)),
  ).flat();
  const today = startOfDay(new Date()).getTime();
  const [detailDay, setDetailDay] = useState<Date | null>(null);

  const detailEvents = detailDay
    ? events.filter((e) => e.start <= detailDay.getTime() && e.end >= detailDay.getTime())
    : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-5 gap-2 pb-2 text-center">
        {WEEKDAYS.map((d, i) => (
          <span
            key={d}
            className="py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            title={WEEKDAYS_LONG[i]}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => {
          const time = d.getTime();
          const dayEvents = events.filter((e) => e.start <= time && e.end >= time);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = time === today;
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "flex min-h-28 flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors sm:min-h-32",
                isToday
                  ? "border-primary/60 bg-primary/8"
                  : "border-border/50 bg-background/60 hover:border-border hover:bg-accent/30",
                inMonth ? "" : "opacity-45",
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onPickDay(d)}
                  className={cn(
                    "rounded-md px-1 text-xs font-semibold transition-colors hover:text-primary",
                    isToday ? "text-primary" : "text-foreground",
                  )}
                >
                  {d.getDate()}
                </button>
                {isToday ? (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Heute
                  </span>
                ) : null}
              </div>

              {dayEvents.slice(0, 2).map((e) => (
                <EventBar key={e.id} event={e} label={e.title} />
              ))}
              {dayEvents.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setDetailDay(d)}
                  className="rounded-md px-1 text-left text-[11px] font-medium text-muted-foreground hover:text-primary"
                >
                  + {dayEvents.length - 2} weitere
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <Dialog open={detailDay !== null} onOpenChange={(open) => !open && setDetailDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {detailDay ? dayFmt.format(detailDay) : ""}
            </DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-border/60">
            {detailEvents.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
