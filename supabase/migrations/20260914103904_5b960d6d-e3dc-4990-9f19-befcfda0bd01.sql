ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['user'::text, 'site_manager'::text, 'warehouse_manager'::text, 'admin'::text]));

CREATE TABLE public.machine_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT machine_properties_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 80)
);
GRANT SELECT ON public.machine_properties TO authenticated;
GRANT ALL ON public.machine_properties TO service_role;
ALTER TABLE public.machine_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view machine properties"
  ON public.machine_properties FOR SELECT TO authenticated USING (true);
CREATE UNIQUE INDEX machine_properties_name_lower_key
  ON public.machine_properties (lower(btrim(name)));
CREATE INDEX machine_properties_name_search_idx
  ON public.machine_properties (lower(name) text_pattern_ops);

CREATE TABLE public.machine_property_assignments (
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.machine_properties(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (machine_id, property_id)
);
GRANT SELECT ON public.machine_property_assignments TO authenticated;
GRANT ALL ON public.machine_property_assignments TO service_role;
ALTER TABLE public.machine_property_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view machine property assignments"
  ON public.machine_property_assignments FOR SELECT TO authenticated USING (true);
CREATE INDEX machine_property_assignments_property_idx
  ON public.machine_property_assignments (property_id);