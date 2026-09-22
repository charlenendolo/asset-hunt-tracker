import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { cleanPropertyName, normalizePropertyName } from "@/lib/property-name";

/**
 * Alternative Suchbegriffe eines Geräts setzen.
 *
 * Spiegelt bewusst die Eigenschaften-Architektur: ein wiederverwendbarer
 * Katalog plus Zuordnung. Die Schreibweise der Eingabe bleibt erhalten, die
 * Eindeutigkeit ist gross-/kleinschreibungsunabhängig — „Stemmhammer“ und
 * „stemmhammer“ werden also nie zwei Katalogeinträge.
 */
export async function replaceMachineSearchTerms(
  admin: SupabaseClient<Database>,
  machineId: string,
  values: string[],
) {
  const unique = new Map<string, string>();
  for (const value of values) {
    const name = cleanPropertyName(value);
    const key = normalizePropertyName(name);
    if (key && !unique.has(key)) unique.set(key, name);
  }

  const { data: catalog, error: catalogError } = await admin
    .from("machine_search_terms")
    .select("id, name");
  if (catalogError) throw catalogError;

  const byName = new Map((catalog ?? []).map((row) => [normalizePropertyName(row.name), row]));
  const ids: string[] = [];
  for (const [key, name] of unique) {
    const existing = byName.get(key);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const { data: created, error } = await admin
      .from("machine_search_terms")
      .insert({ name })
      .select("id")
      .single();
    if (error || !created) {
      // Gleichzeitig angelegter Begriff: den vorhandenen Eintrag verwenden.
      const { data: concurrent } = await admin
        .from("machine_search_terms")
        .select("id")
        .ilike("name", name)
        .maybeSingle();
      if (!concurrent) throw error ?? new Error("Suchbegriff konnte nicht gespeichert werden.");
      ids.push(concurrent.id);
    } else {
      ids.push(created.id);
    }
  }

  const { error: clearError } = await admin
    .from("machine_search_term_assignments")
    .delete()
    .eq("machine_id", machineId);
  if (clearError) throw clearError;

  if (ids.length > 0) {
    const { error } = await admin
      .from("machine_search_term_assignments")
      .insert(ids.map((termId) => ({ machine_id: machineId, term_id: termId })));
    if (error) throw error;
  }
}
