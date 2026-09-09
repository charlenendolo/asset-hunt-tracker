import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar-view";

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

function CalendarPage() {
  return (
    <AppShell title="Kalender" description="Reservierungen, Wartungen und Prüfungen">
      <CalendarView
        mode="planning"
        title="Kalender"
        description="Geplante Reservierungen, anstehende Wartungen und Prüfungen."
      />
    </AppShell>
  );
}
