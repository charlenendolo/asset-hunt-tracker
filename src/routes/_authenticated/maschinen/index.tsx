import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Container, ChevronLeft, ChevronRight, Plus, ImageOff } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProfile } from "@/hooks/use-profile";
import { SiteCombobox } from "@/components/site-combobox";
import { categoriesQuery, machinesQuery } from "@/lib/queries";
import { SITE_TYPE_LABELS, SITE_TYPE_ORDER } from "@/lib/site-types";
import { MACHINE_STATUS_DB_VALUES, MACHINE_STATUS_LABELS, MACHINE_STATUS_ORDER } from "@/lib/status";
import { formatNumber, textOrDash } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maschinen/")({
  head: () => ({
    meta: [
      { title: "Maschinen & Geräte – AssetHunt" },
      {
        name: "description",
        content: "Übersicht aller Maschinen und Geräte mit Status, Standort und Verantwortlichen.",
      },
      { property: "og:title", content: "Maschinen & Geräte – AssetHunt" },
      {
        property: "og:description",
        content: "Übersicht aller Maschinen und Geräte mit Status, Standort und Verantwortlichen.",
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
  const { isAdmin } = useCurrentProfile();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [locationType, setLocationType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name:asc");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({ search, categoryId, siteId, locationType, status, sort, page, pageSize: PAGE_SIZE }),
    [search, categoryId, siteId, locationType, status, sort, page],
  );

  const categories = useQuery(categoriesQuery);
  const machines = useQuery({ ...machinesQuery(filters), placeholderData: keepPreviousData });

  const rows = machines.data?.rows ?? [];
  const total = machines.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(search || categoryId || siteId || locationType || status);

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <AppShell
      title="Maschinen & Geräte"
      description={total > 0 ? `${formatNumber(total)} Einträge` : undefined}
      actions={
        isAdmin ? (
          <Button className="h-10 font-medium" disabled>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Maschine hinzufügen</span>
          </Button>
        ) : null
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => reset(setSearch)(e.target.value)}
            placeholder="Suche nach Name, Code, Seriennummer …"
            className="h-10 bg-card pl-9"
          />
        </div>
        <Select label="Kategorie" value={categoryId} onChange={reset(setCategoryId)}>
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
          onChange={(v) => {
            reset(setLocationType)(v);
            setSiteId("");
          }}
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
          onChange={reset(setSiteId)}
          typeFilter={locationType}
          emptyLabel="Alle Standorte"
          allowCreate={false}
          className="h-10 bg-card"
        />

        <Select label="Status" value={status} onChange={reset(setStatus)}>
          <option value="">Alle Status</option>
          {MACHINE_STATUS_ORDER.map((k) => (
            <option key={k} value={MACHINE_STATUS_DB_VALUES[k]}>
              {MACHINE_STATUS_LABELS[k]}
            </option>
          ))}
        </Select>
        <Select label="Sortierung" value={sort} onChange={reset(setSort)}>
          <option value="name:asc">Name (A–Z)</option>
          <option value="name:desc">Name (Z–A)</option>
          <option value="asset_code:asc">Gerätenummer aufsteigend</option>
          <option value="created_at:desc">Zuletzt hinzugefügt</option>
        </Select>
      </div>

      {machines.isError ? (
        <ErrorState message={(machines.error as Error)?.message} />
      ) : machines.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Container className="h-7 w-7" strokeWidth={1.5} />}
          title={
            hasFilters
              ? "Keine Treffer für die aktuelle Filterung."
              : "Noch keine Maschinen & Geräte vorhanden."
          }
          description={
            hasFilters
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
                    <td className="px-4 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to="/maschinen/$machineId"
                        params={{ machineId: m.id }}
                        className="flex items-center gap-3"
                      >
                        <Thumb name={m.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {m.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {textOrDash(
                              [m.manufacturer, m.model].filter(Boolean).join(" ") || null,
                            )}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.asset_code}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {textOrDash(m.category?.name)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{textOrDash(m.site?.name)}</td>
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
              <li key={m.id}>
                <Link
                  to="/maschinen/$machineId"
                  params={{ machineId: m.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                >
                  <Thumb name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.asset_code} · {textOrDash(m.site?.name)}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
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
    </AppShell>
  );
}

function Thumb({ name }: { name: string }) {
  return (
    <span
      aria-label={name}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground"
    >
      <ImageOff className="h-4 w-4" strokeWidth={1.5} />
    </span>
  );
}
