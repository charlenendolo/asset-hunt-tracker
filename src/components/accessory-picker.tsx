import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { accessoryNamesQuery } from "@/lib/queries";
import { canonicalAccessoryName, normalizeAccessoryName } from "@/lib/accessory-name";
import { cn } from "@/lib/utils";

/** Gängige Grundbegriffe, damit die Auswahl auch ohne Bestand nutzbar ist. */
const BASE_SUGGESTIONS = [
  "Transportkoffer",
  "Ladegerät",
  "Akku",
  "Netzteil",
  "Schlauch",
  "Anschlusskabel",
  "Adapter",
];

export type AccessoryDraft = { name: string; quantity: number; required: boolean };

export function useAccessoryCatalog() {
  const names = useQuery(accessoryNamesQuery);
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const n of [...(names.data ?? []), ...BASE_SUGGESTIONS]) {
      const key = normalizeAccessoryName(n);
      if (key && !map.has(key)) map.set(key, n);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "de"));
  }, [names.data]);
}

/**
 * Durchsuchbare Zubehör-Auswahl mit standardisierten Bezeichnungen.
 * Neue Bezeichnungen sind möglich, werden aber gegen den Katalog normalisiert,
 * damit keine Schreibvarianten entstehen.
 */
export function AccessoryCombobox({
  catalog,
  onPick,
  className,
}: {
  catalog: string[];
  onPick: (name: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.trim().replace(/\s+/g, " ");
  const matches = useMemo(() => {
    if (!query) return catalog.slice(0, 20);
    const key = normalizeAccessoryName(query);
    return catalog.filter((n) => normalizeAccessoryName(n).includes(key)).slice(0, 20);
  }, [catalog, query]);
  const exact = query && catalog.some((n) => normalizeAccessoryName(n) === normalizeAccessoryName(query));

  function pick(name: string) {
    onPick(canonicalAccessoryName(name, catalog));
    setSearch("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate text-muted-foreground">Zubehör suchen oder neu anlegen…</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Zubehör suchen oder neu anlegen…"
          />
          <CommandList>
            {matches.length === 0 && !query ? (
              <CommandEmpty>Noch keine Bezeichnungen vorhanden.</CommandEmpty>
            ) : null}
            {matches.length > 0 ? (
              <CommandGroup heading="Bekannte Bezeichnungen">
                {matches.map((n) => (
                  <CommandItem key={n} value={n} onSelect={() => pick(n)}>
                    <Check className="h-4 w-4 opacity-0" />
                    <span className="truncate">{n}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {query && !exact ? (
              <CommandGroup>
                <CommandItem value={`neu-${query}`} onSelect={() => pick(query)}>
                  <Plus className="h-4 w-4" />
                  <span className="truncate">„{query}“ als neues Zubehör hinzufügen</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Zubehörliste mit Menge und Pflicht-Kennzeichen (für das Anlege-Formular). */
export function AccessoryDraftList({
  items,
  onChange,
}: {
  items: AccessoryDraft[];
  onChange: (items: AccessoryDraft[]) => void;
}) {
  const catalog = useAccessoryCatalog();

  function add(name: string) {
    const key = normalizeAccessoryName(name);
    const index = items.findIndex((i) => normalizeAccessoryName(i.name) === key);
    if (index >= 0) {
      const next = [...items];
      next[index] = { ...next[index]!, quantity: next[index]!.quantity + 1 };
      onChange(next);
      return;
    }
    onChange([...items, { name, quantity: 1, required: true }]);
  }

  function update(index: number, patch: Partial<AccessoryDraft>) {
    const next = [...items];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <AccessoryCombobox catalog={catalog} onPick={add} className="h-11" />
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Noch kein Zubehör ausgewählt.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={item.required}
                  onCheckedChange={(v) => update(index, { required: v === true })}
                />
                Pflicht
              </label>
              <Input
                type="number"
                min={1}
                max={999}
                aria-label={`Menge ${item.name}`}
                value={item.quantity}
                onChange={(e) =>
                  update(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                }
                className="h-9 w-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${item.name} entfernen`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
