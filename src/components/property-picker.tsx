import { useQuery } from "@tanstack/react-query";

import { TagPicker } from "@/components/tag-picker";
import { machinePropertyCatalogQuery, machineSearchTermCatalogQuery } from "@/lib/queries";

export function PropertyPicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const catalog = useQuery(machinePropertyCatalogQuery);
  return (
    <TagPicker
      values={values}
      onChange={onChange}
      catalog={catalog.data ?? []}
      triggerLabel="Eigenschaft suchen oder neu anlegen…"
      searchPlaceholder="Eigenschaft suchen…"
      catalogHeading="Bekannte Eigenschaften"
      emptyLabel="Noch keine Eigenschaften ausgewählt."
    />
  );
}

/** Alternative Suchbegriffe: verbessern nur die Suche, nie den Gerätenamen. */
export function SearchTermPicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const catalog = useQuery(machineSearchTermCatalogQuery);
  return (
    <TagPicker
      values={values}
      onChange={onChange}
      catalog={catalog.data ?? []}
      triggerLabel="Suchbegriff suchen oder neu anlegen…"
      searchPlaceholder="Suchbegriff suchen…"
      catalogHeading="Bekannte Suchbegriffe"
      emptyLabel="Noch keine alternativen Suchbegriffe."
    />
  );
}
