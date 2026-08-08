import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "AssetHunt – Maschinen- und Geräteverwaltung" },
      {
        name: "description",
        content:
          "AssetHunt: interne Plattform zur Verwaltung von Maschinen, Geräten, Standorten und Reservierungen.",
      },
      { property: "og:title", content: "AssetHunt – Maschinen- und Geräteverwaltung" },
      {
        property: "og:description",
        content:
          "AssetHunt: interne Plattform zur Verwaltung von Maschinen, Geräten, Standorten und Reservierungen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
