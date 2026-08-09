import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Repenning Geräteportal – Maschinen- und Geräteverwaltung" },
      {
        name: "description",
        content:
          "Repenning Geräteportal: interne Plattform zur Verwaltung von Maschinen, Geräten, Standorten und Reservierungen.",
      },
      { property: "og:title", content: "Repenning Geräteportal – Maschinen- und Geräteverwaltung" },
      {
        property: "og:description",
        content:
          "Repenning Geräteportal: interne Plattform zur Verwaltung von Maschinen, Geräten, Standorten und Reservierungen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
