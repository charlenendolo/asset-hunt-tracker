import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { allReservationsQuery } from "@/lib/queries";
import { formatDateTime, textOrDash } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/kalender")({
  head: () => ({
    meta: [
      { title: "Kalender – AssetHunt" },
      { name: "description", content: "Monatsansicht aller Gerätereservierungen." },
      { property: "og:title", content: "Kalender – AssetHunt" },
      { property: "og:description", content: "Monatsansicht aller Gerätereservierungen." },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const reservations = useQuery(allReservationsQuery);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const rows = reservations.data ?? [];

  function reservationsOn(day: Date) {
    const from = startOfDay(day).getTime();
    const to = from + 86_400_000 - 1;
    return rows.filter((r) => {
      const s = new Date(r.start_at).getTime();
      const e = new Date(r.end_at).getTime();
      return s <= to && e >= from;
    });
  }

  const selectedDate = selected ? new Date(selected) : null;
  const selectedRows = selectedDate ? reservationsOn(selectedDate) : [];
  const todayKey = startOfDay(new Date()).toDateString();

  return (
    <AppShell title="Kalender" description="Reservierungen im Monatsüberblick">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border border-border bg-card p-4">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">{monthFmt.format(cursor)}</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Vorheriger Monat"
                onClick={() =>
                  setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Nächster Monat"
                onClick={() =>
                  setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {reservations.isError ? (
            <ErrorState message={(reservations.error as Error)?.message} />
          ) : reservations.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="py-1">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const count = reservationsOn(d).length;
                  const isToday = d.toDateString() === todayKey;
                  const isSelected = selectedDate?.toDateString() === d.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => setSelected(d.toISOString())}
                      className={[
                        "flex min-h-14 flex-col items-start rounded-md border px-2 py-1.5 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-accent/50",
                        inMonth ? "text-foreground" : "text-muted-foreground/50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "text-xs font-medium",
                          isToday ? "text-primary" : "",
                        ].join(" ")}
                      >
                        {d.getDate()}
                      </span>
                      {count > 0 ? (
                        <span className="mt-auto text-[11px] text-muted-foreground">
                          {count} Res.
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            {selectedDate
              ? selectedDate.toLocaleDateString("de-DE", { dateStyle: "long" })
              : "Tag auswählen"}
          </h2>
          {!selectedDate ? (
            <EmptyState
              className="border-0 py-8"
              icon={<CalendarDays className="h-6 w-6" strokeWidth={1.5} />}
              title="Wählen Sie einen Tag aus."
            />
          ) : selectedRows.length === 0 ? (
            <EmptyState className="border-0 py-8" title="Keine Reservierungen an diesem Tag." />
          ) : (
            <ul className="divide-y divide-border">
              {selectedRows.map((r) => (
                <li key={r.id} className="py-2.5">
                  {r.machine ? (
                    <Link
                      to="/maschinen/$machineId"
                      params={{ machineId: r.machine.id }}
                      className="text-sm font-medium text-foreground hover:text-primary"
                    >
                      {r.machine.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-foreground">–</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(r.start_at)} – {formatDateTime(r.end_at)} ·{" "}
                    {textOrDash(r.site?.name)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
