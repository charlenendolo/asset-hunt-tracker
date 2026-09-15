import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Container,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Printer,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { usePrimaryPhotos } from "@/hooks/use-primary-photos";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { AddMachineButton } from "@/components/machine-form";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteCombobox } from "@/components/site-combobox";
import { LabelPrintDialog } from "@/components/label-print";
import { useIdentity } from "@/hooks/use-identity";
import {
  categoriesQuery,
  machinesQuery,
  sitesQuery,
  inspectionWarningDaysQuery,
  OVERDUE_FILTER,
  INSPECTION_DUE_FILTER,
  INSPECTION_MISSING_FILTER,
} from "@/lib/queries";
import { DEFAULT_INSPECTION_WARNING_DAYS } from "@/lib/due-dates";

import { OverdueBadge } from "@/components/overdue-badge";
import { InspectionBadge } from "@/components/inspection-badge";
import { isOverdue } from "@/lib/overdue";
import { SITE_TYPE_LABELS, SITE_TYPE_ORDER } from "@/lib/site-types";
import {
  MACHINE_STATUS_DB_VALUES,
  MACHINE_STATUS_LABELS,
  MACHINE_STATUS_ORDER,
} from "@/lib/status";
import { formatNumber, textOrDash } from "@/lib/format";
import { SiteTypeIcon } from "@/components/site-type-icon";
import { PropertyTags } from "@/components/machine-properties";

const SORT_FIELDS = [
  { value: "name", label: "Name" },
  { value: "asset_code", label: "Gerätenummer" },
  { value: "status", label: "Status" },
  { value: "created_at", label: "Hinzugefügt" },
] as const;

type MachinesSearch = {
  q?: string;
  categoryId?: string;
  siteId?: string;
  locationType?: string;
  status?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  mine?: true;
};

export const Route = createFileRoute("/_authenticated/maschinen/")({
  validateSearch: (search: Record<string, unknown>): MachinesSearch => {
    const str = (key: string) => (typeof search[key] === "string" ? (search[key] as string) : "");
    const status = str("status");
    const siteId = str("siteId");
    const categoryId = str("categoryId");
    const locationType = str("locationType");
    const q = str("q");
    const sortRaw = str("sort");
    const sort = SORT_FIELDS.some((f) => f.value === sortRaw) ? sortRaw : "";
    const dir = str("dir") === "desc" ? ("desc" as const) : str("dir") === "asc" ? ("asc" as const) : undefined;
    const pageRaw = Number(search["page"]);
    const page = Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : undefined;
    // Nur ein Boolean-Flag: die Identität kommt immer aus der Session, nie aus der URL.
    const mine = search["mine"] === true || search["mine"] === "true";
    return {
      ...(q ? { q } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { status } : {}),
      ...(siteId ? { siteId } : {}),
      ...(locationType ? { locationType } : {}),
      ...(sort ? { sort } : {}),
      ...(dir ? { dir } : {}),
      ...(page ? { page } : {}),
      ...(mine ? { mine: true as const } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Geräte" },
      {
        name: "description",
        content: "Übersicht aller Geräte mit Status, Standort und Verantwortlichen.",
      },
      { property: "og:title", content: "Geräte – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Übersicht aller Geräte mit Status, Standort und Verantwortlichen.",
      },
    ],
  }),
  component: MachinesPage,
});

const PAGE_SIZE = 25;

function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring/30"
    >
      {children}
    </select>
  );
}

function MachinesPage() {
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  // Die URL ist die einzige Quelle für Suche, Filter, Sortierung und Seite —
  // deshalb bleibt der Listenzustand beim Zurückspringen aus einem Gerät erhalten.
  const search = urlSearch.q ?? "";
  const categoryId = urlSearch.categoryId ?? "";
  const siteId = urlSearch.siteId ?? "";
  const locationType = urlSearch.locationType ?? "";
  const status = urlSearch.status ?? "";
  const sortField = urlSearch.sort ?? "name";
  const sortDir = urlSearch.dir ?? "asc";
  const sort = `${sortField}:${sortDir}`;
  const page = urlSearch.page ?? 1;

  const [selected, setSelected] = useState<Record<string, true>>({});
  const [labelDialog, setLabelDialog] = useState(false);
  const identity = useIdentity();

  function patchSearch(patch: Partial<MachinesSearch>, resetPage = true) {
    void navigate({
      search: (prev) => {
        const next = { ...prev, ...patch } as MachinesSearch;
        if (resetPage) delete next.page;
        for (const key of Object.keys(next) as (keyof MachinesSearch)[]) {
          if (next[key] === "" || next[key] === undefined) delete next[key];
        }
        return next;
      },
      replace: true,
    });
  }

  function setPage(next: number) {
    patchSearch(next > 1 ? { page: next } : { page: undefined }, false);
  }

  // „Meine Geräte“: Obhut immer aus der Session ableiten, nie aus der URL.
  const mineActive = urlSearch.mine === true;
  const mineUserId = mineActive ? identity.userId : null;

  // Vorwarnzeit für „Prüfpflichtig“ — gleiche Einstellung wie Dashboard.
  const warningDays = useQuery(inspectionWarningDaysQuery);
  const inspectionWarningDays = warningDays.data ?? DEFAULT_INSPECTION_WARNING_DAYS;

  const filters = useMemo(
    () => ({
      search,
      categoryId,
      siteId,
      locationType,
      status: status || "",
      sort,
      page,
      pageSize: PAGE_SIZE,
      inspectionWarningDays,
      ...(mineUserId ? { responsibleUserId: mineUserId } : {}),
    }),
    [
      search,
      categoryId,
      siteId,
      locationType,
      status,
      sort,
      page,
      mineUserId,
      inspectionWarningDays,
    ],
  );

  const categories = useQuery(categoriesQuery);
  const sites = useQuery(sitesQuery);
  const activeSite = siteId ? ((sites.data ?? []).find((s) => s.id === siteId) ?? null) : null;

  const machines = useQuery({
    ...machinesQuery(filters),
    enabled: !mineActive || !!mineUserId,
    placeholderData: keepPreviousData,
  });

  const rows = machines.data?.rows ?? [];
  const photoUrls = usePrimaryPhotos(rows.map((m) => m.id));
  const total = machines.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(search || categoryId || siteId || locationType || status || mineActive);
  const isLoadingList = machines.isLoading || (mineActive && !mineUserId);

  // Landet die Seite nach einer Filteränderung außerhalb des Ergebnisses, zurück auf 1.
  useEffect(() => {
    if (!machines.isFetching && page > pageCount) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageCount, machines.isFetching]);

  const canSelect = identity.isAdmin;
  const selectedIds = Object.keys(selected);
  const selectedMachines = useMemo(
    () =>
      rows
        .filter((m) => selected[m.id])
        .map((m) => ({ id: m.id, name: m.name, asset_code: m.asset_code })),
    [rows, selected],
  );
  const allVisibleSelected = rows.length > 0 && rows.every((m) => selected[m.id]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = true;
      else delete next[id];
      return next;
    });
  }


  return (
    <AppShell
      title="Geräte"
      description={total > 0 ? `${formatNumber(total)} Einträge` : undefined}
    >
      <PageHeader
        icon={<Container className="h-5 w-5" strokeWidth={1.75} />}
        title={mineActive ? "Meine Geräte" : "Geräteportal"}
        description={
          mineActive
            ? "Geräte, die dir aktuell zugewiesen sind."
            : "Gesamter Gerätebestand mit Status, Standort und Verantwortlichkeit."
        }
        actions={<AddMachineButton className="h-10 font-medium" />}
      />

      {mineActive ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Nur meine Geräte
          </span>
        </div>
      ) : null}

      {activeSite ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Standort: {activeSite.name}
            <button
              type="button"
              aria-label="Standortfilter entfernen"
              onClick={() => patchSearch({ siteId: "" })}
              className="rounded-full p-0.5 transition-colors hover:bg-primary/15"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      ) : null}

      {canSelect && selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {selectedIds.length} Maschine{selectedIds.length === 1 ? "" : "n"} ausgewählt
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected({})}>
              Auswahl leeren
            </Button>
            <Button size="sm" onClick={() => setLabelDialog(true)}>
              <Printer className="mr-2 h-4 w-4" /> {selectedIds.length} Etiketten drucken
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card/60 p-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => patchSearch({ q: e.target.value })}
            placeholder="Suche nach Name, Code, Seriennummer …"
            className="h-10 bg-card pl-9"
          />
        </div>
        <Select
          label="Kategorie"
          value={categoryId}
          onChange={(v) => patchSearch({ categoryId: v })}
        >
          <option value="">Alle Kategorien</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          label="Standorttyp"
          value={locationType}
          onChange={(v) => patchSearch({ locationType: v, siteId: "" })}
        >
          <option value="">Alle Standorttypen</option>
          {SITE_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {SITE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <SiteCombobox
          value={siteId}
          onChange={(v) => patchSearch({ siteId: v })}
          typeFilter={locationType}
          emptyLabel="Alle Standorte"
          allowCreate={false}
          className="h-10 bg-card"
        />

        <Select label="Status" value={status} onChange={(v) => patchSearch({ status: v })}>
          <option value="">Alle Status</option>
          {MACHINE_STATUS_ORDER.map((k) => (
            <option key={k} value={MACHINE_STATUS_DB_VALUES[k]}>
              {MACHINE_STATUS_LABELS[k]}
            </option>
          ))}
          <option value={OVERDUE_FILTER}>Überfällig</option>
          <option value={INSPECTION_DUE_FILTER}>Prüfpflichtig</option>
          <option value={INSPECTION_MISSING_FILTER}>Prüftermin fehlt</option>
        </Select>
        <div className="flex min-w-0 gap-2">
          <Select
            label="Sortierfeld"
            value={sortField}
            onChange={(v) => patchSearch({ sort: v, dir: sortDir })}
          >
            {SORT_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            className="h-10 shrink-0"
            aria-label={sortDir === "asc" ? "Absteigend sortieren" : "Aufsteigend sortieren"}
            title={sortDir === "asc" ? "Aufsteigend" : "Absteigend"}
            onClick={() =>
              patchSearch({ sort: sortField, dir: sortDir === "asc" ? "desc" : "asc" })
            }
          >
            {sortDir === "asc" ? (
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ArrowDown className="h-4 w-4" strokeWidth={2} />
            )}
            <span className="ml-1 text-xs">{sortDir === "asc" ? "A–Z" : "Z–A"}</span>
          </Button>
        </div>
      </div>

      {machines.isError ? (
        <ErrorState message={(machines.error as Error)?.message} />
      ) : isLoadingList ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Container className="h-7 w-7" strokeWidth={1.5} />}
          title={
            mineActive
              ? "Du hast aktuell keine Geräte ausgeliehen."
              : hasFilters
                ? "Keine Treffer für die aktuelle Filterung."
                : "Noch keine Maschinen & Geräte vorhanden."
          }
          description={
            mineActive
              ? "Scanne den QR-Code an einem Gerät, um es dir zuzuweisen."
              : hasFilters
                ? "Passe Suche oder Filter an."
                : "Füge das erste Gerät hinzu oder importiere eine bestehende Geräteliste."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  {canSelect ? (
                    <th className="w-10 px-4 py-3">
                      <Checkbox
                        checked={allVisibleSelected}
                        aria-label="Alle sichtbaren Geräte auswählen"
                        onCheckedChange={(checked) =>
                          setSelected((prev) => {
                            const next = { ...prev };
                            for (const m of rows) {
                              if (checked) next[m.id] = true;
                              else delete next[m.id];
                            }
                            return next;
                          })
                        }
                      />
                    </th>
                  ) : null}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Gerät</th>
                  <th className="px-4 py-3">Gerätenummer</th>
                  <th className="px-4 py-3">Kategorie</th>
                  <th className="px-4 py-3">Standort</th>
                  <th className="px-4 py-3">Verantwortlich</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-accent/40">
                    {canSelect ? (
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={!!selected[m.id]}
                          aria-label={`${m.name} auswählen`}
                          onCheckedChange={(checked) => toggle(m.id, checked === true)}
                        />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge
                          status={m.status}
                          siteType={m.site?.location_type ?? null}
                          responsibleUserId={m.responsible_user_id}
                        />
                        {isOverdue(m) ? (
                          <OverdueBadge expectedReturnAt={m.expected_return_at} />
                        ) : null}
                        <InspectionBadge machine={m} />
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        to="/maschinen/$machineId"
                        params={{ machineId: m.id }}
                        className="flex items-center gap-3"
                      >
                        <Thumb name={m.name} src={photoUrls[m.id]} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {m.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {textOrDash(
                              [m.manufacturer, m.model].filter(Boolean).join(" ") || null,
                            )}
                          </span>
                          <span className="mt-1 block">
                            <PropertyTags
                              names={(m.properties ?? []).flatMap((item) =>
                                item.property ? [item.property.name] : [],
                              )}
                              limit={2}
                            />
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.asset_code}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {textOrDash(m.category?.name)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        {m.site ? (
                          <SiteTypeIcon type={m.site.location_type} withTitle={false} />
                        ) : null}
                        {textOrDash(m.site?.name)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {textOrDash(m.responsible?.full_name)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-2 lg:hidden">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                {canSelect ? (
                  <Checkbox
                    checked={!!selected[m.id]}
                    aria-label={`${m.name} auswählen`}
                    onCheckedChange={(checked) => toggle(m.id, checked === true)}
                  />
                ) : null}
                <Link
                  to="/maschinen/$machineId"
                  params={{ machineId: m.id }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                >
                  <Thumb name={m.name} src={photoUrls[m.id]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.asset_code} ·{" "}
                      <span className="inline-flex items-center gap-1 align-middle">
                        {m.site ? (
                          <SiteTypeIcon
                            type={m.site.location_type}
                            className="h-3.5 w-3.5"
                            withTitle={false}
                          />
                        ) : null}
                        {textOrDash(m.site?.name)}
                      </span>
                    </p>
                    {isOverdue(m) ? (
                      <OverdueBadge expectedReturnAt={m.expected_return_at} className="mt-1.5" />
                    ) : null}
                    <InspectionBadge machine={m} className="mt-1.5" />
                    <span className="mt-1.5 block">
                      <PropertyTags
                        names={(m.properties ?? []).flatMap((item) =>
                          item.property ? [item.property.name] : [],
                        )}
                        limit={2}
                      />
                    </span>
                  </div>
                  <StatusBadge
                    status={m.status}
                    siteType={m.site?.location_type ?? null}
                    responsibleUserId={m.responsible_user_id}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Seite {page} von {pageCount} · {formatNumber(total)} Einträge
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Zurück
              </Button>
              <Button
                variant="outline"
                className="h-10"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Weiter <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {canSelect ? (
        <LabelPrintDialog
          machines={selectedMachines}
          open={labelDialog}
          onOpenChange={setLabelDialog}
        />
      ) : null}
    </AppShell>
  );
}

function Thumb({ name, src }: { name: string; src?: string | undefined }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  return (
    <span
      aria-label={name}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground"
    >
      <ImageOff className="h-4 w-4" strokeWidth={1.5} />
    </span>
  );
}
