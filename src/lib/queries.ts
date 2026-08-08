import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export const sitesQuery = queryOptions({
  queryKey: ["sites"],
  staleTime: FIVE_MIN,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sites")
      .select("id, name, site_number, address, active, created_at")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  staleTime: FIVE_MIN,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, active, created_at")
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  },
});

export type MachineFilters = {
  search: string;
  categoryId: string;
  siteId: string;
  status: string;
  sort: string;
  page: number;
  pageSize: number;
};

export const MACHINE_LIST_SELECT =
  "id, asset_code, name, status, manufacturer, model, current_site_id, category_id, responsible_user_id, next_inspection_date, category:machine_categories(id, name), site:sites(id, name), responsible:profiles(id, full_name)";

export function machinesQuery(filters: MachineFilters) {
  return queryOptions({
    queryKey: ["machines", filters],
    staleTime: 60 * 1000,
    queryFn: async () => {
      let q = supabase
        .from("machines")
        .select(MACHINE_LIST_SELECT, { count: "exact" })
        .eq("active", true);

      if (filters.search.trim()) {
        const term = `%${filters.search.trim()}%`;
        q = q.or(
          `name.ilike.${term},asset_code.ilike.${term},serial_number.ilike.${term},manufacturer.ilike.${term},model.ilike.${term}`,
        );
      }
      if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
      if (filters.siteId) q = q.eq("current_site_id", filters.siteId);
      if (filters.status) q = q.eq("status", filters.status);

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
          "*, category:machine_categories(id, name), site:sites(id, name, site_number, address), responsible:profiles(id, full_name)",
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
              "id, start_at, end_at, status, notes, site:sites(id, name), reserved:profiles(id, full_name)",
            )
            .eq("machine_id", id)
            .order("start_at", { ascending: false })
            .limit(20),
          supabase
            .from("movements")
            .select(
              "id, movement_type, condition, comment, created_at, from_site:sites!movements_from_site_id_fkey(id, name), to_site:sites!movements_to_site_id_fkey(id, name), performer:profiles!movements_performed_by_fkey(id, full_name)",
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
        "id, start_at, end_at, status, notes, machine:machines(id, name, asset_code), site:sites(id, name), reserved:profiles(id, full_name)",
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
        "id, description, severity, status, created_at, machine:machines(id, name, asset_code), site:sites(id, name), reporter:profiles!defects_reported_by_fkey(id, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
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
