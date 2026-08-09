import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { plannerQuery } from "@/lib/queries";
import { useIdentity } from "@/hooks/use-identity";
import { formatDate, textOrDash } from "@/lib/format";
import { machineStatusKey, type StatusKey } from "@/lib/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({
    meta: [
      { title: "Kalender – AssetHunt" },
      {
        name: "description",
        content: "Einsatzplanung als Tages-, Wochen- und Monatsansicht für alle Geräte an Wochentagen.",
      },
      { property: "og:title", content: "Kalender – AssetHunt" },
      {
        property: "og:description",
        content: "Einsatzplanung als Tages-, Wochen- und Monatsansicht für alle Geräte an Wochentagen.",
      },
    ],
  }),
  component: CalendarPage,
});

/* ------------------------------------------------------------------ Helpers */

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr"];
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
function sameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
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

const KIND_STYLES: Record<EventKind, { block: string; dot: string; label: string }> = {
  reservation: {
    block: "bg-status-reserved/15 text-status-reserved border-status-reserved/30",
    dot: "bg-status-reserved",
    label: "Reservierung",
  },
  borrowed: {
    block: "bg-status-borrowed/15 text-status-borrowed border-status-borrowed/30",
    dot: "bg-status-borrowed",
    label: "Ausgeliehen",
  },
  maintenance: {
    block: "bg-status-maintenance/15 text-status-maintenance border-status-maintenance/30",
    dot: "bg-status-maintenance",
    label: "Wartung",
  },
  defect: {
    block: "bg-status-defect/15 text-status-defect border-status-defect/30",
    dot: "bg-status-defect",
    label: "Defekt",
  },
};

const STATUS_TINT: Record<StatusKey, string> = {
  available: "bg-status-available/10 text-status-available",
  reserved: "bg-status-reserved/10 text-status-reserved",
  borrowed: "bg-status-borrowed/10 text-status-borrowed",
  maintenance: "bg-status-maintenance/10 text-status-maintenance",
  defect: "bg-status-defect/10 text-status-defect",
  unknown: "bg-muted text-muted-foreground",
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
  const machineById = useMemo(
    () => new Map(machines.map((m) => [m.id, m] as const)),
    [machines],
  );

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
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" strokeWidth={1.75} />}
        title="Einsatzplanung"
        description="Tages-, Wochen- und Monatsansicht aller Geräte auf einen Blick."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-card p-0.5">
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
            <Button variant="outline" className="h-9" onClick={() => setCursor(startOfDay(new Date()))}>
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
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">{rangeLabel}</h2>
        <Legend />
      </div>

      {planner.isError ? (
        <ErrorState message={(planner.error as Error)?.message} />
      ) : planner.isLoading ? (
        <Skeleton className="h-96 w-full rounded-xl" />
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

/* ----------------------------------------------------------------- Day view */

type MachineRow = {
  id: string;
  name: string;
  asset_code: string;
  status: string | null;
  expected_return_at?: string | null;
  site?: { name: string } | null;
  responsible?: { full_name: string | null } | null;
};

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
    { kind: "reservation", title: "Reserviert", rows: [] },
    { kind: "borrowed", title: "Ausgeliehen", rows: [] },
    { kind: "maintenance", title: "In Wartung", rows: [] },
    { kind: "defect", title: "Defekt", rows: [] },
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
      <p className="text-sm text-muted-foreground">{dayFmt.format(day)}</p>
      {visible.map((g) => (
        <section key={g.kind}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                g.kind === "available"
                  ? "bg-status-available"
                  : KIND_STYLES[g.kind as EventKind].dot,
              )}
            />
            {g.title}
            <span className="text-xs font-normal text-muted-foreground">({g.rows.length})</span>
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {g.rows.map((m) => {
              const ev = (byMachine.get(m.id) ?? [])[0];
              return (
                <li key={m.id}>
                  <Link
                    to="/maschinen/$machineId"
                    params={{ machineId: m.id }}
                    className="block rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/4"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.asset_code} · {textOrDash(m.site?.name)}
                    </p>
                    {ev?.detail ? (
                      <p
                        className={cn(
                          "mt-2 truncate rounded-md px-2 py-1 text-xs",
                          STATUS_TINT[
                            ev.kind === "reservation"
                              ? "reserved"
                              : ev.kind === "borrowed"
                                ? "borrowed"
                                : ev.kind === "maintenance"
                                  ? "maintenance"
                                  : "defect"
                          ],
                        )}
                      >
                        {ev.detail}
                      </p>
                    ) : null}
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

  const rows = machines
    .map((m) => ({
      machine: m,
      events: events.filter(
        (e) =>
          e.machineId === m.id &&
          e.start <= days[4]!.getTime() &&
          e.end >= days[0]!.getTime(),
      ),
    }))
    .filter((r) => r.events.length > 0 || machines.length <= 60);

  if (rows.length === 0) {
    return <EmptyState title="Keine Geräte in dieser Woche." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="min-w-[680px]">
        <div className="grid grid-cols-[200px_repeat(5,minmax(0,1fr))] border-b border-border bg-primary/5">
          <div className="px-4 py-3 text-xs font-medium text-muted-foreground">Maschine</div>
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                "px-2 py-3 text-center text-xs font-medium",
                d.getTime() === today ? "bg-primary/12 text-primary" : "text-muted-foreground",
              )}
            >
              <span className="block">{WEEKDAYS[(d.getDay() + 6) % 7]}</span>
              <span className="block text-sm text-foreground">{d.getDate()}</span>
            </div>
          ))}
        </div>

        <div className="divide-y divide-border">
          {rows.map(({ machine, events: rowEvents }) => (
            <div
              key={machine.id}
              className="grid grid-cols-[200px_repeat(5,minmax(0,1fr))] transition-colors hover:bg-accent/30"
            >
              <div className="min-w-0 px-4 py-2.5">
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

              <div className="relative col-span-5 grid grid-cols-5 gap-px py-2">
                {days.map((d) => (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "min-h-11 rounded-sm",
                      d.getTime() === today ? "bg-primary/6" : "bg-transparent",
                    )}
                  />
                ))}

                <div className="pointer-events-none absolute inset-x-0 inset-y-2 grid grid-cols-5 gap-px">
                  {rowEvents.map((e) => {
                    const from = Math.max(
                      0,
                      Math.round((e.start - days[0]!.getTime()) / DAY),
                    );
                    const to = Math.min(4, Math.round((e.end - days[0]!.getTime()) / DAY));
                    const span = Math.max(1, to - from + 1);
                    return (
                      <div
                        key={e.id}
                        title={`${KIND_STYLES[e.kind].label}: ${e.title}${e.detail ? " – " + e.detail : ""}`}
                        style={{ gridColumn: `${from + 1} / span ${span}` }}
                        className={cn(
                          "truncate self-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          KIND_STYLES[e.kind].block,
                        )}
                      >
                        {KIND_STYLES[e.kind].label}
                        {e.detail ? ` · ${e.detail}` : ""}
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

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="grid grid-cols-5 gap-1 pb-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {days.map((d) => {
          const time = d.getTime();
          const dayEvents = events.filter((e) => e.start <= time && e.end >= time);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = time === today;
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn(
                "flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
                isToday
                  ? "border-primary bg-primary/8"
                  : "border-transparent hover:border-border hover:bg-accent/40",
                inMonth ? "" : "opacity-45",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  isToday ? "text-primary" : "text-foreground",
                )}
              >
                {d.getDate()}
              </span>
              {dayEvents.slice(0, 3).map((e) => (
                <span
                  key={e.id}
                  className={cn(
                    "truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                    KIND_STYLES[e.kind].block,
                  )}
                >
                  {machineById.get(e.machineId)?.name ?? e.title}
                </span>
              ))}
              {dayEvents.length > 3 ? (
                <span className="px-1 text-[10px] font-medium text-muted-foreground">
                  + {dayEvents.length - 3} weitere
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        Tippe auf einen Tag für die Tagesansicht. Stand: {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}
