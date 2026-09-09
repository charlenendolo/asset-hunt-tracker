import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar-view";

export const Route = createFileRoute("/_authenticated/pruefkalender")({
  head: () => ({
    meta: [
      { title: "Prüfkalender – Repenning Geräteportal" },
      {
        name: "description",
        content: "Alle anstehenden Prüftermine prüfpflichtiger Geräte im Überblick.",
      },
      { property: "og:title", content: "Prüfkalender – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Alle anstehenden Prüftermine prüfpflichtiger Geräte im Überblick.",
      },
    ],
  }),
  component: InspectionCalendarPage,
});

function InspectionCalendarPage() {
  return (
    <AppShell title="Prüfkalender" description="Alle Prüftermine prüfpflichtiger Geräte">
      <CalendarView
        mode="inspections"
        title="Prüfkalender"
        description="Vollständige Prüfplanung — unabhängig von der Vorwarnzeit des Dashboards."
      />
    </AppShell>
  );
}
