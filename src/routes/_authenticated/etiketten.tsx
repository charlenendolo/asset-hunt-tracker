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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SiteCombobox } from "@/components/site-combobox";
import { LabelPrintDialog, PrintLabelButton, QrDownloadButtons } from "@/components/label-print";
import { useMachineQrSvgs } from "@/hooks/use-machine-qr";
import { categoriesQuery, machinesQuery } from "@/lib/queries";
import { MACHINE_STATUS_DB_VALUES, MACHINE_STATUS_LABELS, MACHINE_STATUS_ORDER } from "@/lib/status";
import { getMachineQrUrl, labelName, type LabelMachine } from "@/lib/qr-labels";
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

function QrThumb({ svg, onClick }: { svg: string | undefined; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="QR-Code vergrößern"
      className="h-10 w-10 shrink-0 rounded-md border border-border bg-white p-0.5"
    >
      {svg ? (
        <span
          className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </button>
  );
}

function QrPreviewDialog({
  machine,
  svg,
  open,
  onOpenChange,
}: {
  machine: LabelMachine | null;
  svg: string | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {machine ? (
          <>
            <DialogHeader>
              <DialogTitle>{labelName(machine)}</DialogTitle>
              <DialogDescription>
                {machine.asset_code ?? "Gerätenummer fehlt"}
              </DialogDescription>
            </DialogHeader>
            <div className="mx-auto h-56 w-56 rounded-lg border border-border bg-white p-3">
              {svg ? (
                <span
                  className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : null}
            </div>
            <p className="break-all text-center text-xs text-muted-foreground">
              {getMachineQrUrl(machine.id)}
            </p>
            <div className="flex flex-col gap-2">
              <PrintLabelButton machine={machine} />
              <QrDownloadButtons machine={machine} svg={svg} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function LabelsPage() {
  const identity = useIdentity();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, true>>({});
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

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
    enabled: identity.isAdmin,
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

  // QR nur für die aktuell sichtbare Seite erzeugen — skaliert auf tausende Geräte.
  const visibleIds = useMemo(() => rows.map((m) => m.id), [rows]);
  const { svgs } = useMachineQrSvgs(identity.isAdmin ? visibleIds : []);
  const previewMachine = useMemo(() => {
    const m = rows.find((r) => r.id === previewId);
    return m ? { id: m.id, name: m.name, asset_code: m.asset_code } : null;
  }, [rows, previewId]);

  if (!identity.isLoading && !identity.isAdmin) {
    return (
      <AppShell title="Etiketten & QR-Codes">
        <EmptyState
          icon={<QrCode className="h-7 w-7" strokeWidth={1.5} />}
          title="Kein Zugriff."
          description="Die Etikettenverwaltung ist ausschließlich Administratoren vorbehalten."
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
            Etiketten drucken
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
            placeholder="Maschinen suchen …"
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
          Auswahl aufheben
        </Button>
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} Maschine{selectedIds.length === 1 ? "" : "n"} ausgewählt ·{" "}
          {formatNumber(total)} Geräte gefunden
        </p>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {selectedIds.length} Maschine{selectedIds.length === 1 ? "" : "n"} ausgewählt
            {selectedMachines.length < selectedIds.length
              ? ` · ${selectedMachines.length} auf dieser Seite druckbar`
              : ""}
          </p>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Printer className="mr-2 h-4 w-4" /> Etiketten drucken
          </Button>
        </div>
      ) : null}

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
            <li key={m.id} className="flex items-center gap-3 px-3 py-2">
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
              <QrThumb svg={svgs[m.id]} onClick={() => setPreviewId(m.id)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {m.asset_code ? (
                    <span className="font-mono">{m.asset_code}</span>
                  ) : (
                    <span className="text-status-defect">⚠ Gerätenummer fehlt</span>
                  )}{" "}
                  <Link
                    to="/maschinen/$machineId"
                    params={{ machineId: m.id }}
                    className="font-normal text-foreground/90 hover:underline"
                  >
                    {m.name}
                  </Link>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {textOrDash(m.category?.name)} · {textOrDash(m.site?.name)}
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
      <QrPreviewDialog
        machine={previewMachine}
        svg={previewMachine ? svgs[previewMachine.id] : undefined}
        open={!!previewMachine}
        onOpenChange={(v) => {
          if (!v) setPreviewId(null);
        }}
      />
    </AppShell>
  );
}
