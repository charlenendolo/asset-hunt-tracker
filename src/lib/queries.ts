import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { machineStatusDbValues, machineStatusKey } from "@/lib/status";
import { listProfiles } from "@/lib/users.functions";

const FIVE_MIN = 5 * 60 * 1000;

/** Lightweight lists used for filters — small tables, cached long. */
export const categoriesQuery = queryOptions({
  queryKey: ["machine_categories"],
  staleTime: FIVE_MIN,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("machine_categories")
      .select("id, name")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
});

/**
 * Zubehör-Katalog für die Auswahl: eindeutige Bezeichnungen aus den bereits
 * vorhandenen Zubehördatensätzen (kein eigenes Stammdatenmodell nötig).
 * Es werden nur Bezeichnungen zurückgegeben, keine Datensätze anderer Maschinen.
 */
export const accessoryNamesQuery = queryOptions({
  queryKey: ["accessories", "names"],
  staleTime: FIVE_MIN,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("accessories")
      .select("name")
      .order("name")
      .limit(2000);
    if (error) throw error;
    const seen = new Map<string, string>();
    for (const row of data ?? []) {
      const raw = (row.name ?? "").trim().replace(/\s+/g, " ");
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, raw);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "de"));
  },
});

export const sitesQuery = queryOptions({
  queryKey: ["sites"],
  staleTime: FIVE_MIN,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sites")
      .select("id, name, site_number, address, active, location_type, created_at")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
});

/**
 * Role/active are privileged columns and are only returned to admins by the
 * server function; regular users receive the name directory.
 */
export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  staleTime: FIVE_MIN,
  queryFn: async () => listProfiles(),
});

/** Pseudo-Statuswert für den abgeleiteten Überfällig-Filter (kein DB-Status). */
export const OVERDUE_FILTER = "overdue";

export type MachineFilters = {
  search: string;
  categoryId: string;
  siteId: string;
  /** Standorttyp (sites.location_type) — leer = alle Typen. */
  locationType: string;
  status: string;
  sort: string;
  page: number;
  pageSize: number;
  /** Nur Geräte in der Obhut dieser Person (machines.responsible_user_id). */
  responsibleUserId?: string;
};

export const MACHINE_LIST_SELECT =
  "id, asset_code, name, status, manufacturer, model, current_site_id, category_id, responsible_user_id, next_inspection_date, expected_return_at, category:machine_categories(id, name), site:sites(id, name, location_type), responsible:profiles(id, full_name)";

export function machinesQuery(filters: MachineFilters) {
  return queryOptions({
    queryKey: ["machines", filters],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from("machines")
        .select(MACHINE_LIST_SELECT, { count: "exact" })
        .eq("active", true);

      if (filters.responsibleUserId) {
        q = q.eq("responsible_user_id", filters.responsibleUserId);
      }
      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        q = q.or(
          `name.ilike.${term},asset_code.ilike.${term},serial_number.ilike.${term},manufacturer.ilike.${term},model.ilike.${term}`,
        );
      }
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.siteId) q = q.eq("current_site_id", filters.siteId);
      if (filters.locationType && !filters.siteId) {
        // Standorttyp-Filter über die Standorte des gewählten Typs.
        const { data: typeSites, error: typeError } = await supabase
          .from("sites")
          .select("id")
          .eq("location_type", filters.locationType);
        if (typeError) throw typeError;
        const ids = (typeSites ?? []).map((s) => s.id);
        if (ids.length === 0) return { rows: [], count: 0 };
        q = q.in("current_site_id", ids);
      }
      if (filters.status === OVERDUE_FILTER) {
        // Abgeleiteter Zustand: ausgeliehen + Rückgabefrist überschritten.
        q = q
          .in("status", machineStatusDbValues("borrowed"))
          .not("expected_return_at", "is", null)
          .lt("expected_return_at", new Date().toISOString());
      } else if (filters.status) {
        q = q.in("status", machineStatusDbValues(machineStatusKey(filters.status)));
      }

      const [column, direction] = filters.sort.split(":");
      q = q.order(column ?? "name", { ascending: direction !== "desc" });

      const from = (filters.page - 1) * filters.pageSize;
      q = q.range(from, from + filters.pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });
}

export function machineStatusCountsQuery() {
  return queryOptions({
    queryKey: ["machines", "status-counts"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select("status")
        .eq("active", true)
        .limit(5000);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const key = row.status ?? "unknown";
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return { total: data?.length ?? 0, counts };
    },
  });
}

export function machineDetailQuery(id: string) {
  return queryOptions({
    queryKey: ["machine", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select(
          "*, category:machine_categories(id, name), site:sites(id, name, site_number, address, location_type), responsible:profiles(id, full_name)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function machineRelationsQuery(id: string) {
  return queryOptions({
    queryKey: ["machine", id, "relations"],
    queryFn: async () => {
      const [accessories, reservations, movements, defects, maintenance, photos] =
        await Promise.all([
          supabase
            .from("accessories")
            .select("id, name, quantity, required")
            .eq("machine_id", id)
            .order("name"),
          supabase
            .from("reservations")
            .select(
              "id, start_at, end_at, status, notes, reserved_by, site:sites(id, name), reserved:profiles(id, full_name)",
            )
            .eq("machine_id", id)
            .order("start_at", { ascending: false })
            .limit(20),
          supabase
            .from("movements")
            .select(
              "id, movement_type, condition, comment, equipment_complete, created_at, responsible:profiles!movements_responsible_user_id_fkey(id, full_name), from_site:sites!movements_from_site_id_fkey(id, name), to_site:sites!movements_to_site_id_fkey(id, name), performer:profiles!movements_performed_by_fkey(id, full_name)",
            )
            .eq("machine_id", id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("defects")
            .select("id, description, severity, status, created_at, resolved_at")
            .eq("machine_id", id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("maintenance")
            .select(
              "id, maintenance_type, scheduled_date, completed_date, status, service_provider, cost, notes",
            )
            .eq("machine_id", id)
            .order("scheduled_date", { ascending: false })
            .limit(20),
          supabase
            .from("machine_photos")
            .select("id, storage_path, is_primary")
            .eq("machine_id", id)
            .order("is_primary", { ascending: false }),
        ]);

      const firstError = [accessories, reservations, movements, defects, maintenance, photos].find(
        (r) => r.error,
      );
      if (firstError?.error) throw firstError.error;

      return {
        accessories: accessories.data ?? [],
        reservations: reservations.data ?? [],
        movements: movements.data ?? [],
        defects: defects.data ?? [],
        maintenance: maintenance.data ?? [],
        photos: photos.data ?? [],
      };
    },
  });
}

export const upcomingReservationsQuery = queryOptions({
  queryKey: ["reservations", "upcoming"],
  staleTime: 60 * 1000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id, start_at, end_at, status, machine:machines(id, name, asset_code), site:sites(id, name), reserved:profiles(id, full_name)",
      )
      .gte("end_at", new Date().toISOString())
      .order("start_at")
      .limit(8);
    if (error) throw error;
    return data ?? [];
  },
});

export const allReservationsQuery = queryOptions({
  queryKey: ["reservations", "all"],
  staleTime: 60 * 1000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id, start_at, end_at, status, notes, reserved_by, machine:machines(id, name, asset_code), site:sites(id, name), reserved:profiles(id, full_name)",
      )
      .order("start_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },
});

export const openDefectsQuery = queryOptions({
  queryKey: ["defects", "list"],
  staleTime: 60 * 1000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("defects")
      .select(
        "id, description, severity, status, created_at, resolved_at, machine:machines(id, name, asset_code, status), site:sites(id, name), reporter:profiles!defects_reported_by_fkey(id, full_name), resolver:profiles!defects_resolved_by_fkey(id, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },
});

/**
 * Geräte mit Status "defekt", zu denen kein offener Defektvorgang existiert.
 * Reine Lesekonsistenzprüfung — es werden keine Daten erzeugt.
 */
export const defectInconsistenciesQuery = queryOptions({
  queryKey: ["defects", "inconsistencies"],
  staleTime: 60 * 1000,
  queryFn: async () => {
    const [machines, open] = await Promise.all([
      supabase
        .from("machines")
        .select("id, name, asset_code, current_site_id, site:sites(id, name)")
        .eq("status", "defective")
        .eq("active", true)
        .limit(500),
      supabase.from("defects").select("machine_id").neq("status", "resolved").limit(1000),
    ]);
    if (machines.error) throw machines.error;
    if (open.error) throw open.error;
    const withDefect = new Set((open.data ?? []).map((d) => d.machine_id));
    return (machines.data ?? []).filter((m) => !withDefect.has(m.id));
  },
});


export const maintenanceQuery = queryOptions({
  queryKey: ["maintenance", "list"],
  staleTime: 60 * 1000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("maintenance")
      .select(
        "id, maintenance_type, scheduled_date, completed_date, status, service_provider, cost, machine:machines(id, name, asset_code)",
      )
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  },
});

export const recentMovementsQuery = queryOptions({
  queryKey: ["movements", "recent"],
  staleTime: 60 * 1000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("movements")
      .select(
        "id, movement_type, created_at, comment, machine:machines(id, name, asset_code), from_site:sites!movements_from_site_id_fkey(id, name), to_site:sites!movements_to_site_id_fkey(id, name), performer:profiles!movements_performed_by_fkey(id, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data ?? [];
  },
});

/** Machine counts per site — one lightweight column read, aggregated client-side. */
export const machinesBySiteCountQuery = queryOptions({
  queryKey: ["machines", "site-counts"],
  staleTime: 60 * 1000,
  queryFn: async (): Promise<Record<string, number>> => {
    const { data, error } = await supabase
      .from("machines")
      .select("current_site_id")
      .eq("active", true)
      .limit(5000);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (!row.current_site_id) continue;
      counts[row.current_site_id] = (counts[row.current_site_id] ?? 0) + 1;
    }
    return counts;
  },
});

/** Machines the signed-in user is currently responsible for ("Meine Geräte"). */
export function myMachinesQuery(userId: string | null) {
  return queryOptions({
    queryKey: ["machines", "mine", userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("machines")
        .select(MACHINE_LIST_SELECT)
        .eq("responsible_user_id", userId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Reservations owned by the signed-in user (reservations.reserved_by). */
export const MY_RESERVATION_SELECT =
  "id, start_at, end_at, status, notes, reserved_by, machine:machines(id, name, asset_code, status, category:machine_categories(id, name)), site:sites(id, name)";

export function myReservationsQuery(userId: string | null) {
  return queryOptions({
    queryKey: ["reservations", "mine", userId],
    enabled: !!userId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(MY_RESERVATION_SELECT)
        .eq("reserved_by", userId!)
        .order("start_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Reservations visible to the current role.
 * admin / site_manager: all reservations. user: only their own.
 * (The schema has no site scope on profiles, so managers keep full read access
 * as granted by the existing "Authenticated users can view reservations" RLS.)
 */
export function scopedReservationsQuery(userId: string | null, canSeeAll: boolean) {
  return queryOptions({
    queryKey: ["reservations", "scoped", canSeeAll ? "all" : userId],
    enabled: canSeeAll || !!userId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      let q = supabase
        .from("reservations")
        .select(
          "id, start_at, end_at, status, notes, reserved_by, machine:machines(id, name, asset_code), site:sites(id, name), reserved:profiles(id, full_name)",
        )
        .order("start_at", { ascending: false })
        .limit(300);
      if (!canSeeAll) q = q.eq("reserved_by", userId!);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Datenbasis für den Kalender/Planer: aktive Geräte plus alle belegenden
 * Vorgänge. Reine Leseabfragen auf bestehende Tabellen.
 */
export function plannerQuery(userId: string | null, canSeeAll: boolean) {
  return queryOptions({
    queryKey: ["planner", canSeeAll ? "all" : userId],
    enabled: canSeeAll || !!userId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      let reservationQuery = supabase
        .from("reservations")
        .select(
          "id, machine_id, start_at, end_at, status, notes, reserved_by, machine:machines(id, name, asset_code), site:sites(id, name), reserved:profiles(id, full_name)",
        )
        .neq("status", "cancelled")
        .order("start_at")
        .limit(500);
      if (!canSeeAll) reservationQuery = reservationQuery.eq("reserved_by", userId!);

      const [machines, reservations, defects, maintenance] = await Promise.all([
        supabase
          .from("machines")
          .select(
            "id, name, asset_code, status, expected_return_at, current_site_id, responsible_user_id, category:machine_categories(id, name), site:sites(id, name), responsible:profiles(id, full_name)",
          )
          .eq("active", true)
          .order("name")
          .limit(500),
        reservationQuery,
        supabase
          .from("defects")
          .select("id, machine_id, description, severity, status, created_at")
          .neq("status", "resolved")
          .limit(500),
        supabase
          .from("maintenance")
          .select("id, machine_id, maintenance_type, scheduled_date, completed_date, status")
          .neq("status", "cancelled")
          .limit(500),
      ]);

      const firstError = [machines, reservations, defects, maintenance].find((r) => r.error);
      if (firstError?.error) throw firstError.error;

      return {
        machines: machines.data ?? [],
        reservations: reservations.data ?? [],
        defects: defects.data ?? [],
        maintenance: maintenance.data ?? [],
      };
    },
  });
}

/**
 * Überfällige Geräte (abgeleitet, kein gespeicherter Status): ausgeliehen und
 * expected_return_at in der Vergangenheit. Sichtbarkeit folgt der bestehenden
 * Logik — Mitarbeiter sehen nur die Geräte, für die sie verantwortlich sind.
 * Zusätzlich wird je Gerät die nächste anstehende Reservierung ermittelt.
 */
export function overdueMachinesQuery(userId: string | null, canSeeAll: boolean) {
  return queryOptions({
    queryKey: ["machines", "overdue", canSeeAll ? "all" : userId],
    enabled: canSeeAll || !!userId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("machines")
        .select(MACHINE_LIST_SELECT)
        .eq("active", true)
        .in("status", machineStatusDbValues("borrowed"))
        .not("expected_return_at", "is", null)
        .lt("expected_return_at", nowIso)
        .order("expected_return_at", { ascending: true })
        .limit(200);
      if (!canSeeAll) q = q.eq("responsible_user_id", userId!);

      const { data, error } = await q;
      if (error) throw error;
      const machines = data ?? [];
      if (machines.length === 0) return { machines, nextReservation: {} as Record<string, string> };

      const { data: reservations } = await supabase
        .from("reservations")
        .select("machine_id, start_at")
        .in(
          "machine_id",
          machines.map((m) => m.id),
        )
        .neq("status", "cancelled")
        .gte("start_at", nowIso)
        .order("start_at", { ascending: true })
        .limit(500);

      const nextReservation: Record<string, string> = {};
      for (const r of reservations ?? []) {
        if (r.machine_id && !nextReservation[r.machine_id]) nextReservation[r.machine_id] = r.start_at;
      }
      return { machines, nextReservation };
    },
  });
}
