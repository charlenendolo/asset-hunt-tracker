import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteCombobox } from "@/components/site-combobox";
import { useIdentity } from "@/hooks/use-identity";
import { categoriesQuery } from "@/lib/queries";
import { updateMachine } from "@/lib/machines.functions";

export type EditableMachine = {
  id: string;
  asset_code: string;
  name: string;
  category_id: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  company_inventory_number: string | null;
  current_site_id: string | null;
  description: string | null;
  inspection_required: boolean | null;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
};

/** Stammdatenbearbeitung — ausschließlich für Administratoren. */
export function EditMachineButton({
  machine,
  className,
}: {
  machine: EditableMachine;
  className?: string;
}) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);

  if (identity.isLoading || !identity.isAdmin) return null;

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        <span className="ml-1.5">Gerät bearbeiten</span>
      </Button>
      {open ? <EditDialog machine={machine} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function EditDialog({ machine, onClose }: { machine: EditableMachine; onClose: () => void }) {
  const qc = useQueryClient();
  const categories = useQuery(categoriesQuery);
  const run = useServerFn(updateMachine);
  const [form, setForm] = useState({
    assetCode: machine.asset_code ?? "",
    name: machine.name ?? "",
    categoryId: machine.category_id ?? "",
    manufacturer: machine.manufacturer ?? "",
    model: machine.model ?? "",
    serialNumber: machine.serial_number ?? "",
    companyInventoryNumber: machine.company_inventory_number ?? "",
    siteId: machine.current_site_id ?? "",
    description: machine.description ?? "",
    inspectionRequired: machine.inspection_required === true,
    lastInspectionDate: machine.last_inspection_date ?? "",
    nextInspectionDate: machine.next_inspection_date ?? "",
    purchaseDate: machine.purchase_date ?? "",
    purchasePrice: machine.purchase_price != null ? String(machine.purchase_price) : "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () =>
      run({
        data: {
          machineId: machine.id,
          assetCode: form.assetCode.trim(),
          name: form.name.trim(),
          categoryId: form.categoryId || null,
          manufacturer: form.manufacturer.trim() || null,
          model: form.model.trim() || null,
          serialNumber: form.serialNumber.trim() || null,
          companyInventoryNumber: form.companyInventoryNumber.trim() || null,
          siteId: form.siteId || null,
          description: form.description.trim() || null,
          inspectionRequired: form.inspectionRequired,
          lastInspectionDate: form.lastInspectionDate || null,
          nextInspectionDate: form.nextInspectionDate || null,
          purchaseDate: form.purchaseDate || null,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice.replace(",", ".")) : null,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["machines"] }),
        qc.invalidateQueries({ queryKey: ["machine", machine.id] }),
        qc.invalidateQueries({ queryKey: ["machine-history", machine.id] }),
      ]);
      toast.success("Gerät wurde aktualisiert.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || "Änderung fehlgeschlagen."),
  });

  const valid = form.assetCode.trim().length > 0 && form.name.trim().length > 1;

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerät bearbeiten</DialogTitle>
          <DialogDescription>
            Stammdaten von {machine.name}. Status, Verantwortlichkeit, Defekte und Reservierungen
            bleiben den bestehenden Abläufen vorbehalten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Row>
            <Field label="Gerätenummer *" htmlFor="edit-asset-code">
              <Input
                id="edit-asset-code"
                value={form.assetCode}
                onChange={(e) => set("assetCode", e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Bezeichnung *" htmlFor="edit-name">
              <Input
                id="edit-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="h-11"
              />
            </Field>
          </Row>

          <Row>
            <Field label="Kategorie" htmlFor="edit-category">
              <select
                id="edit-category"
                value={form.categoryId}
                onChange={(e) => set("categoryId", e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Ohne Kategorie</option>
                {(categories.data ?? [])
                  .filter((c) => c.active !== false)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Standort" htmlFor="edit-site">
              <SiteCombobox
                id="edit-site"
                value={form.siteId}
                onChange={(v) => set("siteId", v)}
                className="h-11"
              />
            </Field>
          </Row>

          <Row>
            <Field label="Hersteller" htmlFor="edit-manufacturer">
              <Input
                id="edit-manufacturer"
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Modell" htmlFor="edit-model">
              <Input
                id="edit-model"
                value={form.model}
                onChange={(e) => set("model", e.target.value)}
                className="h-11"
              />
            </Field>
          </Row>

          <Row>
            <Field label="Seriennummer" htmlFor="edit-serial">
              <Input
                id="edit-serial"
                value={form.serialNumber}
                onChange={(e) => set("serialNumber", e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Inventarnummer" htmlFor="edit-inventory">
              <Input
                id="edit-inventory"
                value={form.companyInventoryNumber}
                onChange={(e) => set("companyInventoryNumber", e.target.value)}
                className="h-11"
              />
            </Field>
          </Row>

          <Row>
            <Field label="Anschaffungsdatum" htmlFor="edit-purchase-date">
              <Input
                id="edit-purchase-date"
                type="date"
                value={form.purchaseDate}
                onChange={(e) => set("purchaseDate", e.target.value)}
                className="h-11"
              />
            </Field>
            <Field label="Anschaffungspreis (EUR)" htmlFor="edit-purchase-price">
              <Input
                id="edit-purchase-price"
                inputMode="decimal"
                value={form.purchasePrice}
                onChange={(e) => set("purchasePrice", e.target.value)}
                className="h-11"
              />
            </Field>
          </Row>

          <div className="space-y-1.5">
            <Label>Prüfung</Label>
            <label className="flex h-11 items-center gap-3 rounded-md border border-border px-3">
              <Checkbox
                checked={form.inspectionRequired}
                onCheckedChange={(v) => set("inspectionRequired", v === true)}
              />
              <span className="text-sm">Prüfpflichtig (UVV)</span>
            </label>
          </div>

          {form.inspectionRequired ? (
            <Row>
              <Field label="Letzte Prüfung" htmlFor="edit-last-inspection">
                <Input
                  id="edit-last-inspection"
                  type="date"
                  value={form.lastInspectionDate}
                  onChange={(e) => set("lastInspectionDate", e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field label="Nächste Prüfung" htmlFor="edit-next-inspection">
                <Input
                  id="edit-next-inspection"
                  type="date"
                  value={form.nextInspectionDate}
                  onChange={(e) => set("nextInspectionDate", e.target.value)}
                  className="h-11"
                />
              </Field>
            </Row>
          ) : null}

          <Field label="Beschreibung" htmlFor="edit-description">
            <Textarea
              id="edit-description"
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <p className="text-xs text-muted-foreground">
            Fotos verwaltest du direkt im Bereich „Fotos“ auf dieser Seite.
          </p>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button
            className="h-11 w-full"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Änderungen speichern
          </Button>
          <Button
            variant="ghost"
            className="h-10 w-full"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
