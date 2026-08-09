import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

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
import { createMachine } from "@/lib/machines.functions";

const STATUS_OPTIONS = [
  { value: "available", label: "Verfügbar" },
  { value: "maintenance", label: "Wartung" },
  { value: "defective", label: "Defekt" },
  { value: "retired", label: "Ausgemustert" },
];

type FormState = {
  assetCode: string;
  name: string;
  categoryId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  companyInventoryNumber: string;
  siteId: string;
  status: string;
  description: string;
  inspectionRequired: boolean;
  lastInspectionDate: string;
  nextInspectionDate: string;
  purchaseDate: string;
  purchasePrice: string;
};

const EMPTY: FormState = {
  assetCode: "",
  name: "",
  categoryId: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  companyInventoryNumber: "",
  siteId: "",
  status: "available",
  description: "",
  inspectionRequired: false,
  lastInspectionDate: "",
  nextInspectionDate: "",
  purchaseDate: "",
  purchasePrice: "",
};

/** Anlage neuer Geräte — sichtbar für Administratoren und Bauleiter. */
export function AddMachineButton({ className }: { className?: string }) {
  const identity = useIdentity();
  const [open, setOpen] = useState(false);

  if (identity.isLoading || !identity.canManage) return null;

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        <span className="ml-1.5">Maschine hinzufügen</span>
      </Button>
      {open ? <MachineDialog onClose={() => setOpen(false)} /> : null}
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
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MachineDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const categories = useQuery(categoriesQuery);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const run = useServerFn(createMachine);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const mutation = useMutation({
    mutationFn: async () =>
      run({
        data: {
          assetCode: form.assetCode.trim(),
          name: form.name.trim(),
          categoryId: form.categoryId || null,
          manufacturer: form.manufacturer.trim() || null,
          model: form.model.trim() || null,
          serialNumber: form.serialNumber.trim() || null,
          companyInventoryNumber: form.companyInventoryNumber.trim() || null,
          siteId: form.siteId || null,
          status: form.status as "available",
          description: form.description.trim() || null,
          inspectionRequired: form.inspectionRequired,
          lastInspectionDate: form.lastInspectionDate || null,
          nextInspectionDate: form.nextInspectionDate || null,
          purchaseDate: form.purchaseDate || null,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice.replace(",", ".")) : null,
        },
      }),
    onSuccess: async (machine) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["machines"] }),
        qc.invalidateQueries({ queryKey: ["planner"] }),
      ]);
      toast.success("Maschine wurde angelegt.");
      setCreated({ id: machine.id, name: machine.name });
    },
    onError: (error: Error) => toast.error(error.message || "Anlage fehlgeschlagen."),
  });

  const valid = form.assetCode.trim().length > 0 && form.name.trim().length > 1;

  return (
    <Dialog open onOpenChange={(o) => (!o && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{created ? "Maschine angelegt" : "Maschine hinzufügen"}</DialogTitle>
          <DialogDescription>
            {created
              ? `${created.name} steht ab sofort in der Geräteliste.`
              : "Pflichtangaben sind Gerätenummer und Bezeichnung."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-status-available/25 bg-status-available/8 px-4 py-4 text-sm text-status-available">
              Maschine wurde angelegt.
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  onClose();
                  navigate({ to: "/maschinen/$machineId", params: { machineId: created.id } });
                }}
              >
                Foto hinzufügen
              </Button>
              <Button
                className="h-11"
                onClick={() => {
                  setCreated(null);
                  setForm({ ...EMPTY, siteId: form.siteId, categoryId: form.categoryId });
                }}
              >
                Nächste Maschine erfassen
              </Button>
            </div>
            <Button variant="ghost" className="h-10 w-full" onClick={onClose}>
              Schließen
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Row>
                <Field label="Gerätenummer *" htmlFor="asset-code">
                  <Input
                    id="asset-code"
                    value={form.assetCode}
                    onChange={(e) => set("assetCode", e.target.value)}
                    placeholder="z. B. AH-0042"
                    className="h-11"
                  />
                </Field>
                <Field label="Bezeichnung *" htmlFor="machine-name">
                  <Input
                    id="machine-name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="z. B. Rüttelplatte 90 kg"
                    className="h-11"
                  />
                </Field>
              </Row>

              <Row>
                <Field label="Kategorie" htmlFor="category">
                  <select
                    id="category"
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Ohne Kategorie</option>
                    {(categories.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Standort" htmlFor="machine-site">
                  <SiteCombobox
                    id="machine-site"
                    value={form.siteId}
                    onChange={(v) => set("siteId", v)}
                    className="h-11"
                  />
                </Field>
              </Row>

              <Row>
                <Field label="Hersteller" htmlFor="manufacturer">
                  <Input
                    id="manufacturer"
                    value={form.manufacturer}
                    onChange={(e) => set("manufacturer", e.target.value)}
                    className="h-11"
                  />
                </Field>
                <Field label="Modell" htmlFor="model">
                  <Input
                    id="model"
                    value={form.model}
                    onChange={(e) => set("model", e.target.value)}
                    className="h-11"
                  />
                </Field>
              </Row>

              <Row>
                <Field label="Seriennummer" htmlFor="serial">
                  <Input
                    id="serial"
                    value={form.serialNumber}
                    onChange={(e) => set("serialNumber", e.target.value)}
                    className="h-11"
                  />
                </Field>
                <Field label="Inventarnummer" htmlFor="inventory">
                  <Input
                    id="inventory"
                    value={form.companyInventoryNumber}
                    onChange={(e) => set("companyInventoryNumber", e.target.value)}
                    className="h-11"
                  />
                </Field>
              </Row>

              <Row>
                <Field label="Status" htmlFor="status">
                  <select
                    id="status"
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Anschaffungsdatum" htmlFor="purchase-date">
                  <Input
                    id="purchase-date"
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => set("purchaseDate", e.target.value)}
                    className="h-11"
                  />
                </Field>
              </Row>

              <Row>
                <Field label="Anschaffungspreis (EUR)" htmlFor="purchase-price">
                  <Input
                    id="purchase-price"
                    inputMode="decimal"
                    value={form.purchasePrice}
                    onChange={(e) => set("purchasePrice", e.target.value)}
                    placeholder="z. B. 2450"
                    className="h-11"
                  />
                </Field>
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
              </Row>

              {form.inspectionRequired ? (
                <Row>
                  <Field label="Letzte Prüfung" htmlFor="last-inspection">
                    <Input
                      id="last-inspection"
                      type="date"
                      value={form.lastInspectionDate}
                      onChange={(e) => set("lastInspectionDate", e.target.value)}
                      className="h-11"
                    />
                  </Field>
                  <Field label="Nächste Prüfung" htmlFor="next-inspection">
                    <Input
                      id="next-inspection"
                      type="date"
                      value={form.nextInspectionDate}
                      onChange={(e) => set("nextInspectionDate", e.target.value)}
                      className="h-11"
                    />
                  </Field>
                </Row>
              ) : null}

              <Field label="Beschreibung" htmlFor="description">
                <Textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Besonderheiten, Hinweise"
                />
              </Field>

              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <Label>Zubehör</Label>
                <p className="text-xs text-muted-foreground">
                  Wähle bekannte Bezeichnungen aus oder lege neue an. Menge und Pflicht kannst du
                  je Position anpassen.
                </p>
                <AccessoryDraftList items={accessories} onChange={setAccessories} />
              </div>
            </div>

            <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
              <Button
                className="h-11 w-full"
                disabled={!valid || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Maschine anlegen
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
