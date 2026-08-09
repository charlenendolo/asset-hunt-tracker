import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QrCode, Search, Printer } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteCombobox } from "@/components/site-combobox";
import { LabelPrintDialog } from "@/components/label-print";
import { categoriesQuery, machinesQuery } from "@/lib/queries";
import { MACHINE_STATUS_DB_VALUES, MACHINE_STATUS_LABELS, MACHINE_STATUS_ORDER } from "@/lib/status";
import { useIdentity } from "@/hooks/use-identity";
import { formatNumber, textOrDash } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/etiketten")({
  head: () => ({
    meta: [
      { title: "Etiketten & QR-Codes – Repenning Geräteportal" },
      {
        name: "description",
        content: "Etiketten und permanente QR-Codes für Maschinen erzeugen und drucken.",
      },
      { property: "og:title", content: "Etiketten & QR-Codes – Repenning Geräteportal" },
      {
        property: "og:description",
        content: "Etiketten und permanente QR-Codes für Maschinen erzeugen und drucken.",
      },
    ],
  }),
  component: LabelsPage,
});

const PAGE_SIZE = 50;

function LabelsPage() {
  const identity = useIdentity();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [open, setOpen] = useState(false);

  const filters = useMemo(
    () => ({
      search,
      categoryId,
      siteId,
      locationType: "",
      status,
      sort: "asset_code:asc",
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, categoryId, siteId, status, page],
  );

  const categories = useQuery(categoriesQuery);
  const machines = useQuery({
    ...machinesQuery(filters),
    placeholderData: keepPreviousData,
    enabled: identity.canManage,
  });

  const rows = machines.data?.rows ?? [];
  const total = machines.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedIds = Object.keys(selected);
  const selectedMachines = useMemo(
    () =>
      rows
        .filter((m) => selected[m.id])
        .map((m) => ({ id: m.id, name: m.name, asset_code: m.asset_code })),
    [rows, selected],
  );
  const allVisibleSelected = rows.length > 0 && rows.every((m) => selected[m.id]);

  if (!identity.isLoading && !identity.canManage) {
    return (
      <AppShell title="Etiketten & QR-Codes">
        <EmptyState
          icon={<QrCode className="h-7 w-7" strokeWidth={1.5} />}
          title="Kein Zugriff."
          description="Etikettenverwaltung ist Administratoren und Bauleitern vorbehalten."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Etiketten & QR-Codes" description="Permanente Gerätekennzeichnung">
      <PageHeader
        icon={<QrCode className="h-5 w-5" strokeWidth={1.75} />}
        title="Etiketten & QR-Codes"
        description="QR-Codes verweisen dauerhaft auf die Geräteseite – unabhängig von Name, Status oder Standort."
        actions={
          <Button
            className="h-10 font-medium"
            disabled={selectedIds.length === 0}
            onClick={() => setOpen(true)}
          >
            <Printer className="mr-2 h-4 w-4" />
            {selectedIds.length > 0 ? `${selectedIds.length} Etiketten drucken` : "Etiketten drucken"}
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 rounded-xl border border-border bg-card/60 p-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Suche nach Name oder Gerätenummer …"
            className="h-10 bg-card pl-9"
          />
        </div>
        <select
          aria-label="Kategorie"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="">Alle Kategorien</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <SiteCombobox
          value={siteId}
          onChange={(v) => {
            setSiteId(v);
            setPage(1);
          }}
          emptyLabel="Alle Standorte"
          allowCreate={false}
          className="h-10 bg-card"
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 min-w-0 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="">Alle Status</option>
          {MACHINE_STATUS_ORDER.map((k) => (
            <option key={k} value={MACHINE_STATUS_DB_VALUES[k]}>
              {MACHINE_STATUS_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setSelected((prev) => {
              const next = { ...prev };
              if (allVisibleSelected) {
                for (const m of rows) delete next[m.id];
              } else {
                for (const m of rows) next[m.id] = true;
              }
              return next;
            })
          }
          disabled={rows.length === 0}
        >
          {allVisibleSelected ? "Sichtbare abwählen" : "Alle sichtbaren auswählen"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelected({})}
          disabled={selectedIds.length === 0}
        >
          Auswahl leeren
        </Button>
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} ausgewählt · {formatNumber(total)} Geräte
        </p>
      </div>

      {machines.isError ? (
        <ErrorState message={(machines.error as Error)?.message} />
      ) : machines.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-7 w-7" strokeWidth={1.5} />}
          title="Keine Geräte gefunden."
          description="Passe Suche oder Filter an."
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Checkbox
                checked={!!selected[m.id]}
                onCheckedChange={(checked) =>
                  setSelected((prev) => {
                    const next = { ...prev };
                    if (checked) next[m.id] = true;
                    else delete next[m.id];
                    return next;
                  })
                }
                aria-label={`${m.name} auswählen`}
              />
              <div className="min-w-0 flex-1">
                <Link
                  to="/maschinen/$machineId"
                  params={{ machineId: m.id }}
                  className="block truncate text-sm font-medium text-foreground"
                >
                  {m.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {m.asset_code ? (
                    m.asset_code
                  ) : (
                    <span className="text-status-defect">Gerätenummer fehlt</span>
                  )}{" "}
                  · {textOrDash(m.site?.name)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Seite {page} von {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-10"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Zurück
          </Button>
          <Button
            variant="outline"
            className="h-10"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Weiter
          </Button>
        </div>
      </div>

      <LabelPrintDialog machines={selectedMachines} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
