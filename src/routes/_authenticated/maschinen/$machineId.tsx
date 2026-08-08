import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ImageOff,
  FileText,
  QrCode,
  MessageSquare,
  BadgeCheck,
  BookOpen,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { MachineActions } from "@/components/machine-actions";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge, Pill } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { machineDetailQuery, machineRelationsQuery } from "@/lib/queries";
import { formatCurrency, formatDate, formatDateTime, textOrDash } from "@/lib/format";
import {
  CONDITION_LABELS,
  DEFECT_SEVERITY_LABELS,
  DEFECT_STATUS_LABELS,
  MAINTENANCE_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  RESERVATION_STATUS_LABELS,
  labelFor,
} from "@/lib/status";

export const Route = createFileRoute("/_authenticated/maschinen/$machineId")({
  head: () => ({
    meta: [
      { title: "Gerätedetails – AssetHunt" },
      {
        name: "description",
        content: "Digitaler Gerätepass mit Status, Zubehör, Bewegungen, Defekten und Wartungen.",
      },
      { property: "og:title", content: "Gerätedetails – AssetHunt" },
      {
        property: "og:description",
        content: "Digitaler Gerätepass mit Status, Zubehör, Bewegungen, Defekten und Wartungen.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MachineDetailPage,
});

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode | undefined;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {aside}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function FuturePlaceholder({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Pill className="ml-auto shrink-0">Geplant</Pill>
    </div>
  );
}

function MachineDetailPage() {
  const { machineId } = Route.useParams();
  const machine = useQuery(machineDetailQuery(machineId));
  const relations = useQuery(machineRelationsQuery(machineId));

  if (machine.isLoading) {
    return (
      <AppShell title="Gerät">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  if (machine.isError) {
    return (
      <AppShell title="Gerät">
        <ErrorState message={(machine.error as Error)?.message} />
      </AppShell>
    );
  }

  const m = machine.data;
  if (!m) {
    return (
      <AppShell title="Gerät">
        <EmptyState
          title="Gerät nicht gefunden."
          description="Der Eintrag existiert nicht oder wurde entfernt."
          action={
            <Link to="/maschinen" className="text-sm font-medium text-primary">
              Zurück zur Übersicht
            </Link>
          }
        />
      </AppShell>
    );
  }

  const rel = relations.data;

  return (
    <AppShell title={m.name} description={m.asset_code}>
      <Link
        to="/maschinen"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Maschinen & Geräte
      </Link>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid aspect-[16/7] w-full place-items-center bg-muted text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <ImageOff className="h-7 w-7" strokeWidth={1.5} />
                <p className="text-xs">Kein Foto hinterlegt</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-3">
              <Field label="Status" value={<StatusBadge status={m.status} />} />
              <Field label="Gerätenummer" value={m.asset_code} />
              <Field label="Inventarnummer" value={textOrDash(m.company_inventory_number)} />
              <Field label="Kategorie" value={textOrDash(m.category?.name)} />
              <Field label="Hersteller" value={textOrDash(m.manufacturer)} />
              <Field label="Modell" value={textOrDash(m.model)} />
              <Field label="Seriennummer" value={textOrDash(m.serial_number)} />
              <Field label="Aktueller Standort" value={textOrDash(m.site?.name)} />
              <Field label="Verantwortlich" value={textOrDash(m.responsible?.full_name)} />
              <Field label="Anschaffungsdatum" value={formatDate(m.purchase_date)} />
              <Field label="Anschaffungspreis" value={formatCurrency(m.purchase_price)} />
              <Field
                label="Nächste Prüfung"
                value={m.inspection_required ? formatDate(m.next_inspection_date) : "Nicht erforderlich"}
              />
            </div>
            {m.description ? (
              <div className="border-t border-border px-5 py-4">
                <p className="text-xs text-muted-foreground">Beschreibung</p>
                <p className="mt-1 text-sm text-foreground">{m.description}</p>
              </div>
            ) : null}
          </section>

          <Section title="Bewegungshistorie">
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (rel?.movements.length ?? 0) === 0 ? (
              <EmptyState className="border-0 py-8" title="Noch keine Bewegungen erfasst." />
            ) : (
              <ul className="divide-y divide-border">
                {rel!.movements.map((mv) => (
                  <li key={mv.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {labelFor(MOVEMENT_TYPE_LABELS, mv.movement_type)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {textOrDash(mv.from_site?.name)} → {textOrDash(mv.to_site?.name)} ·{" "}
                        {formatDateTime(mv.created_at)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {mv.equipment_complete === null
                          ? null
                          : mv.equipment_complete
                            ? "Zubehör vollständig"
                            : "Zubehör unvollständig"}
                        {mv.condition ? ` · ${labelFor(CONDITION_LABELS, mv.condition)}` : ""}
                      </p>
                      {mv.comment ? (
                        <p className="mt-0.5 text-xs text-foreground">{mv.comment}</p>
                      ) : null}
                    </div>
                    <Pill>{textOrDash(mv.responsible?.full_name ?? mv.performer?.full_name)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Reservierungen">
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (rel?.reservations.length ?? 0) === 0 ? (
              <EmptyState className="border-0 py-8" title="Noch keine Reservierungen vorhanden." />
            ) : (
              <ul className="divide-y divide-border">
                {rel!.reservations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {formatDateTime(r.start_at)} – {formatDateTime(r.end_at)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {textOrDash(r.site?.name)} · {textOrDash(r.reserved?.full_name)}
                      </p>
                    </div>
                    <Pill>{labelFor(RESERVATION_STATUS_LABELS, r.status)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Defekte">
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (rel?.defects.length ?? 0) === 0 ? (
              <EmptyState className="border-0 py-8" title="Keine offenen Defekte." />
            ) : (
              <ul className="divide-y divide-border">
                {rel!.defects.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {d.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(d.created_at)} ·{" "}
                        {labelFor(DEFECT_STATUS_LABELS, d.status)}
                      </p>
                    </div>
                    <Pill tone="danger">{labelFor(DEFECT_SEVERITY_LABELS, d.severity)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Wartung">
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (rel?.maintenance.length ?? 0) === 0 ? (
              <EmptyState className="border-0 py-8" title="Keine Wartungen fällig." />
            ) : (
              <ul className="divide-y divide-border">
                {rel!.maintenance.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {w.maintenance_type}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(w.scheduled_date)} · {textOrDash(w.service_provider)} ·{" "}
                        {formatCurrency(w.cost)}
                      </p>
                    </div>
                    <Pill tone="warning">{labelFor(MAINTENANCE_STATUS_LABELS, w.status)}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Aktionen">
            <MachineActions
              className="space-y-3"
              machine={{
                id: m.id,
                name: m.name,
                asset_code: m.asset_code,
                status: m.status,
                current_site_id: m.current_site_id,
                responsible_user_id: m.responsible_user_id,
              }}
            />
          </Section>

          <Section title="Zubehör">
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (rel?.accessories.length ?? 0) === 0 ? (
              <EmptyState className="border-0 py-8" title="Kein Zubehör hinterlegt." />
            ) : (
              <ul className="divide-y divide-border">
                {rel!.accessories.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-foreground">{a.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {a.required ? <Pill tone="primary">Pflicht</Pill> : null}
                      <span className="text-sm text-muted-foreground">{a.quantity}×</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Fotos">
            {relations.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (rel?.photos.length ?? 0) === 0 ? (
              <EmptyState className="border-0 py-8" title="Noch keine Fotos hinterlegt." />
            ) : (
              <ul className="grid grid-cols-3 gap-2">
                {rel!.photos.map((p) => (
                  <li
                    key={p.id}
                    className="grid aspect-square place-items-center rounded-md border border-border bg-muted text-xs text-muted-foreground"
                  >
                    <ImageOff className="h-4 w-4" strokeWidth={1.5} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Weitere Module">
            <div className="space-y-2">
              <FuturePlaceholder
                icon={<FileText className="h-4 w-4" strokeWidth={1.75} />}
                title="Dokumente"
                description="Ablage von Lieferscheinen und Verträgen."
              />
              <FuturePlaceholder
                icon={<BadgeCheck className="h-4 w-4" strokeWidth={1.75} />}
                title="Prüfnachweise"
                description="UVV- und Prüfbescheinigungen."
              />
              <FuturePlaceholder
                icon={<BookOpen className="h-4 w-4" strokeWidth={1.75} />}
                title="Handbücher"
                description="Bedienungsanleitungen und Datenblätter."
              />
              <FuturePlaceholder
                icon={<QrCode className="h-4 w-4" strokeWidth={1.75} />}
                title="QR-Code"
                description="Kennzeichnung und Scan-Workflows."
              />
              <FuturePlaceholder
                icon={<MessageSquare className="h-4 w-4" strokeWidth={1.75} />}
                title="Kommentare"
                description="Notizen zum Gerät im Team."
              />
            </div>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
