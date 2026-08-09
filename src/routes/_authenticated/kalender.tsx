import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PackageOpen,
  Wrench,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { plannerQuery } from "@/lib/queries";
import { useIdentity } from "@/hooks/use-identity";
import { textOrDash } from "@/lib/format";
import { machineStatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({
    meta: [
      { title: "Kalender – Repenning Geräteportal" },
      {
        name: "description",
        content:
          "Einsatzplanung als Tages-, Wochen- und Monatsansicht für alle Geräte an Wochentagen.",
      },
      { property: "og:title", content: "Kalender – Repenning Geräteportal" },
      {
        property: "og:description",
        content:
          "Einsatzplanung als Tages-, Wochen- und Monatsansicht für alle Geräte an Wochentagen.",
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

const DAY = 86_400_000;

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
function isWeekend(d: Date) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

type EventKind = "reservation" | "borrowed" | "maintenance" | "defect";

type PlannerEvent = {
  id: string;
  machineId: string;
  kind: EventKind;
  start: number;
  end: number;
  title: string;
  detail: string;
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
  borrowed: {
    bar: "bg-status-borrowed/18 text-status-borrowed ring-1 ring-inset ring-status-borrowed/25 hover:bg-status-borrowed/28",
    dot: "bg-status-borrowed",
    label: "Ausgeliehen",
    icon: PackageOpen,
  },
  maintenance: {
    bar: "bg-status-maintenance/18 text-status-maintenance ring-1 ring-inset ring-status-maintenance/25 hover:bg-status-maintenance/28",
    dot: "bg-status-maintenance",
    label: "Wartung",
    icon: Wrench,
  },
  defect: {
    bar: "bg-status-defect/18 text-status-defect ring-1 ring-inset ring-status-defect/25 hover:bg-status-defect/28",
    dot: "bg-status-defect",
    label: "Defekt",
    icon: AlertTriangle,
  },
};

/* --------------------------------------------------------------------- Page */

type View = "day" | "week" | "month";

function CalendarPage() {
  const identity = useIdentity();
  const planner = useQuery(plannerQuery(identity.userId, identity.canManage));
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));

  const data = planner.data;

  const events = useMemo<PlannerEvent[]>(() => {
    if (!data) return [];
    const list: PlannerEvent[] = [];

    for (const r of data.reservations) {
      list.push({
        id: `res-${r.id}`,
        machineId: r.machine_id,
        kind: "reservation",
        start: startOfDay(new Date(r.start_at)).getTime(),
        end: startOfDay(new Date(r.end_at)).getTime(),
        title: r.machine?.name ?? "Gerät",
        detail: [r.reserved?.full_name, r.site?.name].filter(Boolean).join(" · "),
      });
    }

    for (const m of data.machines) {
      const key = machineStatusKey(m.status);
      if (key === "borrowed") {
        const end = m.expected_return_at
          ? startOfDay(new Date(m.expected_return_at)).getTime()
          : startOfDay(new Date()).getTime() + 30 * DAY;
        list.push({
          id: `out-${m.id}`,
          machineId: m.id,
          kind: "borrowed",
          start: Math.min(startOfDay(new Date()).getTime(), end),
          end,
          title: m.name,
          detail: [m.responsible?.full_name, m.site?.name].filter(Boolean).join(" · "),
        });
      }
    }

    for (const d of data.defects) {
      list.push({
        id: `def-${d.id}`,
        machineId: d.machine_id,
        kind: "defect",
        start: startOfDay(new Date(d.created_at)).getTime(),
        end: startOfDay(new Date()).getTime() + 30 * DAY,
        title: "Defekt",
        detail: d.description.split("\n")[0] ?? "",
      });
    }

    for (const w of data.maintenance) {
      if (!w.scheduled_date) continue;
      const start = startOfDay(new Date(w.scheduled_date)).getTime();
      const end = w.completed_date ? startOfDay(new Date(w.completed_date)).getTime() : start;
      list.push({
        id: `mnt-${w.id}`,
        machineId: w.machine_id,
        kind: "maintenance",
        start,
        end: Math.max(start, end),
        title: w.maintenance_type,
        detail: "Wartung",
      });
    }

    return list;
  }, [data]);

  const machines = data?.machines ?? [];
  const machineById = useMemo(() => new Map(machines.map((m) => [m.id, m] as const)), [machines]);

  function eventsOn(day: Date) {
    const from = startOfDay(day).getTime();
    return events.filter((e) => e.start <= from && e.end >= from);
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
    <AppShell title="Kalender" description="Einsatz- und Reservierungsplanung">
      <section className="mb-5 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border/70 bg-muted/30 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Kalender</h1>
              <p className="text-sm text-muted-foreground">
                Reservierungen, Ausleihen, Wartungen und Defekte im Überblick.
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

      {planner.isError ? (
        <ErrorState message={(planner.error as Error)?.message} />
      ) : planner.isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : view === "day" ? (
        <DayView day={cursor} machines={machines} eventsOn={eventsOn} />
      ) : view === "week" ? (
        <WeekView start={startOfWeek(cursor)} machines={machines} events={events} />
      ) : (
        <MonthView
          cursor={cursor}
          events={events}
          machineById={machineById}
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
    ["bg-status-available", "Verfügbar"],
    ["bg-status-reserved", "Reservierung"],
    ["bg-status-borrowed", "Ausgeliehen"],
    ["bg-status-maintenance", "Wartung"],
    ["bg-status-defect", "Defekt"],
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

type MachineRow = {
  id: string;
  name: string;
  asset_code: string;
  status: string | null;
  expected_return_at?: string | null;
  site?: { name: string } | null;
  responsible?: { full_name: string | null } | null;
};

/** Kompakter Event-Balken — bewusst ohne Tabellenoptik. */
function EventBar({
  event,
  label,
  className,
}: {
  event: PlannerEvent;
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

/* ----------------------------------------------------------------- Day view */

function DayView({
  day,
  machines,
  eventsOn,
}: {
  day: Date;
  machines: MachineRow[];
  eventsOn: (d: Date) => PlannerEvent[];
}) {
  const dayEvents = eventsOn(day);
  const byMachine = new Map<string, PlannerEvent[]>();
  for (const e of dayEvents) {
    byMachine.set(e.machineId, [...(byMachine.get(e.machineId) ?? []), e]);
  }

  const groups: Array<{ kind: EventKind | "available"; title: string; rows: MachineRow[] }> = [
    { kind: "defect", title: "Defekt", rows: [] },
    { kind: "maintenance", title: "In Wartung", rows: [] },
    { kind: "borrowed", title: "Ausgeliehen", rows: [] },
    { kind: "reservation", title: "Reserviert", rows: [] },
    { kind: "available", title: "Verfügbar", rows: [] },
  ];

  const order: EventKind[] = ["defect", "maintenance", "borrowed", "reservation"];
  for (const m of machines) {
    const kinds = (byMachine.get(m.id) ?? []).map((e) => e.kind);
    const primary = order.find((k) => kinds.includes(k));
    const group = groups.find((g) => g.kind === (primary ?? "available"))!;
    group.rows.push(m);
  }

  const visible = groups.filter((g) => g.rows.length > 0);

  if (visible.length === 0) {
    return <EmptyState title="Keine Geräte vorhanden." />;
  }

  return (
    <div className="space-y-5">
      <p className="text-sm capitalize text-muted-foreground">{dayFmt.format(day)}</p>
      {visible.map((g) => (
        <section key={g.kind} className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="flex items-center gap-2 border-b border-border/70 bg-muted/30 px-5 py-3">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                g.kind === "available" ? "bg-status-available" : KIND_STYLES[g.kind as EventKind].dot,
              )}
            />
            <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
            <span className="text-xs text-muted-foreground">({g.rows.length})</span>
          </header>
          <ul className="divide-y divide-border/60">
            {g.rows.map((m) => {
              const ev = (byMachine.get(m.id) ?? [])[0];
              return (
                <li key={m.id}>
                  <Link
                    to="/maschinen/$machineId"
                    params={{ machineId: m.id }}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {m.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {m.asset_code} · {textOrDash(m.site?.name)}
                      </span>
                    </span>
                    {ev ? (
                      <EventBar
                        event={ev}
                        label={ev.detail || KIND_STYLES[ev.kind].label}
                        className="max-w-[60%]"
                      />
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-lg bg-status-available/15 px-2 py-1 text-[11px] font-medium text-status-available">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                        Verfügbar
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Week view */

function WeekView({
  start,
  machines,
  events,
}: {
  start: Date;
  machines: MachineRow[];
  events: PlannerEvent[];
}) {
  const days = Array.from({ length: 5 }, (_, i) => addDays(start, i));
  const today = startOfDay(new Date()).getTime();
  const todayIndex = days.findIndex((d) => d.getTime() === today);

  const rows = machines.map((m) => ({
    machine: m,
    events: events.filter(
      (e) => e.machineId === m.id && e.start <= days[4]!.getTime() && e.end >= days[0]!.getTime(),
    ),
  }));

  if (rows.length === 0) {
    return <EmptyState title="Keine Geräte in dieser Woche." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="min-w-[720px]">
        <div className="sticky top-0 z-10 grid grid-cols-[210px_repeat(5,minmax(0,1fr))] gap-2 border-b border-border/70 bg-muted/40 px-3 py-3 backdrop-blur">
          <div className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Maschine
          </div>
          {days.map((d, i) => (
            <div
              key={d.toISOString()}
              className={cn(
                "rounded-lg px-2 py-1.5 text-center",
                i === todayIndex ? "bg-primary/12 ring-1 ring-inset ring-primary/40" : "",
              )}
            >
              <span
                className={cn(
                  "block text-[11px] font-medium uppercase tracking-wide",
                  i === todayIndex ? "text-primary" : "text-muted-foreground",
                )}
              >
                {WEEKDAYS[(d.getDay() + 6) % 7]}
              </span>
              <span
                className={cn(
                  "block text-sm font-semibold",
                  i === todayIndex ? "text-primary" : "text-foreground",
                )}
              >
                {d.getDate()}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-1 p-3">
          {rows.map(({ machine, events: rowEvents }) => (
            <div
              key={machine.id}
              className="grid grid-cols-[210px_repeat(5,minmax(0,1fr))] items-center gap-2 rounded-xl px-0 py-1 transition-colors hover:bg-accent/30"
            >
              <div className="min-w-0 px-2">
                <Link
                  to="/maschinen/$machineId"
                  params={{ machineId: machine.id }}
                  className="block truncate text-sm font-medium text-foreground hover:text-primary"
                >
                  {machine.name}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {machine.asset_code}
                </span>
              </div>

              <div className="relative col-span-5 grid grid-cols-5 gap-2">
                {days.map((d, i) => (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "min-h-12 rounded-lg",
                      i === todayIndex
                        ? "bg-primary/6 ring-1 ring-inset ring-primary/20"
                        : isWeekend(d)
                          ? "bg-muted/40"
                          : "bg-muted/25",
                    )}
                  />
                ))}

                <div className="pointer-events-none absolute inset-0 grid grid-cols-5 content-center gap-2 py-1.5">
                  {rowEvents.map((e) => {
                    const from = Math.max(0, Math.round((e.start - days[0]!.getTime()) / DAY));
                    const to = Math.min(4, Math.round((e.end - days[0]!.getTime()) / DAY));
                    const span = Math.max(1, to - from + 1);
                    return (
                      <div
                        key={e.id}
                        style={{ gridColumn: `${from + 1} / span ${span}` }}
                        className="pointer-events-auto min-w-0 self-center"
                      >
                        <EventBar
                          event={e}
                          label={`${KIND_STYLES[e.kind].label}${e.detail ? ` · ${e.detail}` : ""}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Month view */

function MonthView({
  cursor,
  events,
  machineById,
  onPickDay,
}: {
  cursor: Date;
  events: PlannerEvent[];
  machineById: Map<string, MachineRow>;
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
                  ? "border-primary/60 bg-primary/8 shadow-[0_0_0_1px_var(--color-primary)]/10"
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
                <EventBar
                  key={e.id}
                  event={e}
                  label={machineById.get(e.machineId)?.name ?? e.title}
                />
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
          <ul className="space-y-2">
            {detailEvents.map((e) => (
              <li key={e.id}>
                <EventBar
                  event={e}
                  label={`${machineById.get(e.machineId)?.name ?? e.title} · ${KIND_STYLES[e.kind].label}`}
                  className="text-xs"
                />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
