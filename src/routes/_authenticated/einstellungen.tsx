import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QrCode } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ChangePasswordForm } from "@/components/change-password";
import { RoleBadge } from "@/components/role-badge";
import { Pill } from "@/components/status-badge";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/use-profile";
import { useIdentity } from "@/hooks/use-identity";
import { categoriesQuery, inspectionWarningDaysQuery } from "@/lib/queries";
import { DEFAULT_INSPECTION_WARNING_DAYS } from "@/lib/due-dates";
import { setInspectionWarningDays } from "@/lib/settings.functions";
import { isPinOnlyEmail } from "@/lib/password-policy";
import { textOrDash } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – Repenning Geräteportal" },
      {
        name: "description",
        content: "Konto, Rolle und Systemangaben von Repenning Geräteportal.",
      },
      { property: "og:title", content: "Einstellungen – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Konto, Rolle und Systemangaben von Repenning Geräteportal.",
      },
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

/** Admin-Einstellung: Vorwarnzeit für fällige Prüfungen (Kalendertage). */
function InspectionWarningSetting() {
  const queryClient = useQueryClient();
  const current = useQuery(inspectionWarningDaysQuery);
  const [days, setDays] = useState<string>("");
  const value = days === "" ? String(current.data ?? DEFAULT_INSPECTION_WARNING_DAYS) : days;

  const save = useMutation({
    mutationFn: async () => setInspectionWarningDays({ data: { days: Number(value) } }),
    onSuccess: async () => {
      toast.success("Vorwarnzeit gespeichert.");
      setDays("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["machines"] }),
      ]);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Speichern nicht möglich."),
  });

  const numeric = Number(value);
  const invalid = !Number.isInteger(numeric) || numeric < 0 || numeric > 365;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-medium text-foreground">Prüfungen</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Wie viele Tage im Voraus soll eine fällige Prüfung im Dashboard und im Gerätefilter
        angezeigt werden? (0–365 Tage, Standard 30)
      </p>
      {current.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            className="h-10 w-28"
            value={value}
            onChange={(e) => setDays(e.target.value)}
            aria-label="Vorwarnzeit in Tagen"
          />
          <span className="text-sm text-muted-foreground">Tage</span>
          <Button
            size="sm"
            disabled={invalid || save.isPending}
            onClick={() => save.mutate()}
            className="ml-auto"
          >
            {save.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      )}
      {invalid ? (
        <p className="mt-2 text-xs text-destructive">
          Bitte einen Wert zwischen 0 und 365 angeben.
        </p>
      ) : null}
    </section>
  );
}

function SettingsPage() {
  const { profile, user, isLoading } = useCurrentProfile();
  const identity = useIdentity();
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
              <Row label="Rolle" value={<RoleBadge role={profile?.role} />} />
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
          <h2 className="mb-1 text-sm font-medium text-foreground">Passwort ändern</h2>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Ändere hier dein eigenes Passwort. Danach meldest du dich mit dem neuen Passwort
                erneut an.
              </p>
              <ChangePasswordForm />
            </>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-2 text-sm font-medium text-foreground">Kategorien</h2>
          {categories.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (categories.data ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Noch keine Kategorien vorhanden.</p>
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
            Wähle, wie Repenning Geräteportal auf diesem Gerät angezeigt wird.
          </p>
          <ThemeSwitch />
        </section>

        {identity.isAdmin ? (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1 text-sm font-medium text-foreground">Etiketten & QR-Codes</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Permanente QR-Etiketten für Maschinen erzeugen und im Stapel drucken.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/etiketten">
                <QrCode className="mr-2 h-4 w-4" /> Etikettenverwaltung öffnen
              </Link>
            </Button>
          </section>
        ) : null}

        {identity.isAdmin ? <InspectionWarningSetting /> : null}

        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-foreground">System</h2>
          <Row label="Anwendung" value="Repenning Geräteportal" />
          <Row label="Sprache" value="Deutsch (DE)" />
          <Row label="Datenquelle" value="Supabase" />
        </section>
      </div>
    </AppShell>
  );
}
