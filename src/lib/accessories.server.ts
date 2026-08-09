import { normalizeAccessoryName } from "./accessory-name";

type Item = { name: string; quantity: number; required: boolean };

type AdminClient = {
  from: (table: "accessories") => any;
};

/**
 * Fügt Zubehör für eine Maschine ein und verhindert Dubletten:
 * - Bezeichnung wird normalisiert (Groß-/Kleinschreibung, Leerzeichen, Umlaute)
 * - existiert die Bezeichnung bereits irgendwo im Bestand, wird die bestehende
 *   Originalschreibweise übernommen
 * - existiert sie bereits an dieser Maschine, wird die Menge erhöht statt
 *   ein zweiter Datensatz angelegt
 */
export async function insertAccessories(
  supabaseAdmin: AdminClient,
  machineId: string,
  items: Item[],
) {
  if (items.length === 0) return { inserted: 0 };

  const { data: catalog } = await supabaseAdmin.from("accessories").select("name").limit(2000);
  const known: string[] = (catalog ?? []).map((r: { name: string }) => r.name);

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("accessories")
    .select("id, name, quantity")
    .eq("machine_id", machineId);
  if (existingError) {
    throw new Error("Zubehör konnte nicht geprüft werden: " + existingError.message);
  }
  const existing = new Map<string, { id: string; quantity: number }>();
  for (const row of (existingRows ?? []) as Array<{
    id: string;
    name: string;
    quantity: number;
  }>) {
    existing.set(normalizeAccessoryName(row.name), { id: row.id, quantity: row.quantity });
  }

  const toInsert: Array<{ machine_id: string; name: string; quantity: number; required: boolean }> =
    [];
  const merged = new Map<string, number>();

  for (const item of items) {
    const key = normalizeAccessoryName(item.name);
    if (!key) continue;
    const canonical =
      known.find((n) => normalizeAccessoryName(n) === key) ?? item.name.trim().replace(/\s+/g, " ");
    const hit = existing.get(key);
    if (hit) {
      merged.set(hit.id, (merged.get(hit.id) ?? hit.quantity) + item.quantity);
      continue;
    }
    const pending = toInsert.find((r) => normalizeAccessoryName(r.name) === key);
    if (pending) {
      pending.quantity += item.quantity;
      continue;
    }
    known.push(canonical);
    toInsert.push({
      machine_id: machineId,
      name: canonical,
      quantity: item.quantity,
      required: item.required,
    });
  }

  for (const [id, quantity] of merged) {
    const { error } = await supabaseAdmin
      .from("accessories")
      .update({ quantity: Math.min(quantity, 999) })
      .eq("id", id);
    if (error) throw new Error("Zubehör konnte nicht aktualisiert werden: " + error.message);
  }

  if (toInsert.length > 0) {
    const { error } = await supabaseAdmin.from("accessories").insert(toInsert);
    if (error) throw new Error("Zubehör konnte nicht gespeichert werden: " + error.message);
  }

  return { inserted: toInsert.length, merged: merged.size };
}
