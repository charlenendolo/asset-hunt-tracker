import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIdentity } from "@/hooks/use-identity";
import { sitesQuery } from "@/lib/queries";
import { createSite, updateSite } from "@/lib/sites.functions";
import { SITE_TYPE_LABELS, SITE_TYPE_ORDER, type SiteType } from "@/lib/site-types";
import { SiteTypeIcon } from "@/components/site-type-icon";
import { cn } from "@/lib/utils";

type SiteRow = {
  id: string;
  name: string;
  site_number: string | null;
  location_type: string;
};

/**
 * Durchsuchbare Standort-Auswahl, gruppiert nach Standorttyp.
 * Fahrzeuge, Lager und Werkstätten sind echte Standorte — kein Freitext.
 */
export function SiteCombobox({
  value,
  onChange,
  emptyLabel = "Kein Standort",
  typeFilter = "",
  allowCreate = true,
  id,
  className,
}: {
  value: string;
  onChange: (siteId: string) => void;
  emptyLabel?: string;
  typeFilter?: string;
  allowCreate?: boolean;
  id?: string;
  className?: string;
}) {
  const identity = useIdentity();
  const sites = useQuery(sitesQuery);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = (sites.data ?? []) as SiteRow[];
  const visible = useMemo(
    () => (typeFilter ? rows.filter((s) => s.location_type === typeFilter) : rows),
    [rows, typeFilter],
  );
  const selected = rows.find((s) => s.id === value) ?? null;
  const canCreate = allowCreate && identity.canManage;

  const grouped = useMemo(
    () =>
      SITE_TYPE_ORDER.map((type) => ({
        type,
        items: visible.filter((s) => s.location_type === type),
      })).filter((g) => g.items.length > 0),
    [visible],
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className={cn("flex min-w-0 items-center gap-2", !selected && "text-muted-foreground")}>
              {selected ? <SiteTypeIcon type={selected.location_type} withTitle={false} /> : null}
              <span className="truncate">
              {selected
                ? `${selected.name} · ${SITE_TYPE_LABELS[selected.location_type as SiteType] ?? "Standort"}`
                : emptyLabel}
              </span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Standort suchen …" />
            <CommandList>
              <CommandEmpty>Kein Standort gefunden.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={emptyLabel}
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                  {emptyLabel}
                </CommandItem>
              </CommandGroup>
              {grouped.map((group) => (
                <CommandGroup key={group.type} heading={SITE_TYPE_LABELS[group.type]}>
                  {group.items.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.name} ${s.site_number ?? ""} ${SITE_TYPE_LABELS[group.type]}`}
                      onSelect={() => {
                        onChange(s.id);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn("h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")}
                      />
                      <SiteTypeIcon type={s.location_type} withTitle={false} />
                      <span className="truncate">{s.name}</span>
                      {s.site_number ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {s.site_number}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {canCreate ? (
                <CommandGroup>
                  <CommandItem
                    value="Neuen Standort hinzufügen"
                    onSelect={() => {
                      setOpen(false);
                      setCreateOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Neuen Standort hinzufügen
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {canCreate ? (
        <CreateSiteDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          defaultType={typeFilter}
          onCreated={(siteId) => onChange(siteId)}
        />
      ) : null}
    </>
  );
}

export function CreateSiteDialog({
  open,
  onOpenChange,
  onCreated,
  defaultType = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (siteId: string) => void;
  defaultType?: string;
}) {
  const queryClient = useQueryClient();
  const submit = useServerFn(createSite);
  const [name, setName] = useState("");
  // Der Typ muss aktiv gewählt werden — kein stiller DB-Default.
  const [locationType, setLocationType] = useState<string>(defaultType);
  const [siteNumber, setSiteNumber] = useState("");
  const [address, setAddress] = useState("");

  const valid = name.trim().length >= 2 && !!locationType;

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          name: name.trim(),
          locationType: locationType as SiteType,
          siteNumber: siteNumber.trim() || null,
          address: address.trim() || null,
        },
      }),
    onSuccess: async (site) => {
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast.success("Standort angelegt.");
      onCreated?.(site.id);
      setName("");
      setLocationType("");
      setSiteNumber("");
      setAddress("");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Standort konnte nicht angelegt werden.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && mutation.isPending ? undefined : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Standort hinzufügen</DialogTitle>
          <DialogDescription>
            Baustelle, Fahrzeug, Lager, Werkstatt oder sonstiger Standort.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="site-name">Bezeichnung</Label>
            <Input
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Baustelle Hauptstraße oder Transporter HH-AB 123"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-type">Standorttyp</Label>
            <select
              id="site-type"
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Bitte auswählen …</option>
              {SITE_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {SITE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {!locationType ? (
              <p className="text-xs text-muted-foreground">
                Bitte wähle einen Typ aus, damit später danach gefiltert werden kann.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-number">Nummer / Kennzeichen (optional)</Label>
            <Input
              id="site-number"
              value={siteNumber}
              onChange={(e) => setSiteNumber(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-address">Adresse (optional)</Label>
            <Input
              id="site-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Abbrechen
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? "Wird angelegt …" : "Standort anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/** Standort bearbeiten — nur Stammdaten, keine Gerätezuordnungen. */
export function EditSiteDialog({
  site,
  open,
  onOpenChange,
}: {
  site: {
    id: string;
    name: string;
    site_number: string | null;
    address: string | null;
    active: boolean;
    location_type: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const submit = useServerFn(updateSite);
  const [name, setName] = useState(site.name);
  const [locationType, setLocationType] = useState<string>(site.location_type);
  const [siteNumber, setSiteNumber] = useState(site.site_number ?? "");
  const [address, setAddress] = useState(site.address ?? "");
  const [active, setActive] = useState(site.active);

  useEffect(() => {
    if (!open) return;
    setName(site.name);
    setLocationType(site.location_type);
    setSiteNumber(site.site_number ?? "");
    setAddress(site.address ?? "");
    setActive(site.active);
  }, [open, site]);

  const valid = name.trim().length >= 2 && !!locationType;

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          siteId: site.id,
          name: name.trim(),
          locationType: locationType as SiteType,
          siteNumber: siteNumber.trim() || null,
          address: address.trim() || null,
          active,
        },
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sites"] }),
        queryClient.invalidateQueries({ queryKey: ["machines"] }),
      ]);
      toast.success("Standort aktualisiert.");
      onOpenChange(false);
    },
    onError: (error: Error) =>
      toast.error(error.message || "Standort konnte nicht gespeichert werden."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && mutation.isPending ? undefined : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Standort bearbeiten</DialogTitle>
          <DialogDescription>
            Änderungen betreffen nur die Standortdaten, nicht die dort erfassten Geräte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-site-name">Bezeichnung</Label>
            <Input
              id="edit-site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-site-type">Standorttyp</Label>
            <select
              id="edit-site-type"
              value={locationType}
              onChange={(e) => setLocationType(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SITE_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {SITE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-site-number">Nummer / Kennzeichen (optional)</Label>
            <Input
              id="edit-site-number"
              value={siteNumber}
              onChange={(e) => setSiteNumber(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-site-address">Adresse (optional)</Label>
            <Input
              id="edit-site-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-11"
            />
          </div>
          <label className="flex items-center gap-3 rounded-md border border-border px-3 py-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm font-medium">Standort aktiv</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Abbrechen
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>
            {mutation.isPending ? "Wird gespeichert …" : "Änderungen speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
