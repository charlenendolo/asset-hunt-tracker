import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { machinePropertyCatalogQuery } from "@/lib/queries";
import { cleanPropertyName, normalizePropertyName } from "@/lib/property-name";

export function PropertyPicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const catalog = useQuery(machinePropertyCatalogQuery);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = cleanPropertyName(search);
  const selected = useMemo(() => new Set(values.map(normalizePropertyName)), [values]);
  const matches = (catalog.data ?? [])
    .filter((item) => !selected.has(normalizePropertyName(item.name)))
    .filter(
      (item) => !query || normalizePropertyName(item.name).includes(normalizePropertyName(query)),
    )
    .slice(0, 20);
  const exact = (catalog.data ?? []).find(
    (item) => normalizePropertyName(item.name) === normalizePropertyName(query),
  );

  function add(name: string) {
    const canonical = exact?.name ?? cleanPropertyName(name);
    if (canonical && !selected.has(normalizePropertyName(canonical)))
      onChange([...values, canonical]);
    setSearch("");
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-11 w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              Eigenschaft suchen oder neu anlegen…
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Eigenschaft suchen…"
            />
            <CommandList className="max-h-[min(60vh,400px)] overflow-y-auto">
              {matches.length > 0 ? (
                <CommandGroup heading="Bekannte Eigenschaften">
                  {matches.map((item) => (
                    <CommandItem key={item.id} value={item.name} onSelect={() => add(item.name)}>
                      <Check className="h-4 w-4 opacity-0" />
                      <span className="truncate">{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {query && !exact ? (
                <CommandGroup>
                  <CommandItem value={`neu-${query}`} onSelect={() => add(query)}>
                    <Plus className="h-4 w-4" />
                    <span className="truncate">„{query}“ hinzufügen</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={normalizePropertyName(value)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {value}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label={`${value} entfernen`}
                onClick={() =>
                  onChange(
                    values.filter(
                      (item) => normalizePropertyName(item) !== normalizePropertyName(value),
                    ),
                  )
                }
              >
                <X className="h-3 w-3" />
              </Button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Noch keine Eigenschaften ausgewählt.</p>
      )}
    </div>
  );
}
