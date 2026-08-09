import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/use-profile";
import { categoriesQuery } from "@/lib/queries";
import { textOrDash } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – AssetHunt" },
      { name: "description", content: "Konto, Rolle und Systemangaben von AssetHunt." },
      { property: "og:title", content: "Einstellungen – AssetHunt" },
      { property: "og:description", content: "Konto, Rolle und Systemangaben von AssetHunt." },
    ],
  }),
  component: SettingsPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function SettingsPage() {
  const { profile, user, isLoading, isAdmin } = useCurrentProfile();
  const categories = useQuery(categoriesQuery);

  return (
    <AppShell title="Einstellungen" description="Konto und Systemangaben">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">Konto</h2>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div>
              <Row label="Name" value={textOrDash(profile?.full_name)} />
              <Row label="E-Mail" value={textOrDash(user?.email ?? null)} />
              <Row
                label="Rolle"
                value={<Pill tone={isAdmin ? "primary" : "neutral"}>{textOrDash(profile?.role)}</Pill>}
              />
              <Row
                label="Status"
                value={
                  <Pill tone={profile?.active ? "success" : "neutral"}>
                    {profile?.active ? "Aktiv" : "Deaktiviert"}
                  </Pill>
                }
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">Kategorien</h2>
          {categories.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (categories.data ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Noch keine Kategorien vorhanden.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 pt-1">
              {categories.data!.map((c) => (
                <li key={c.id}>
                  <Pill>{c.name}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-foreground">Darstellung</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Wähle, wie AssetHunt auf diesem Gerät angezeigt wird.
          </p>
          <ThemeSwitch />
        </section>

        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-foreground">System</h2>
          <Row label="Anwendung" value="AssetHunt" />
          <Row label="Sprache" value="Deutsch (DE)" />
          <Row label="Datenquelle" value="Supabase" />
        </section>
      </div>
    </AppShell>
  );
}
