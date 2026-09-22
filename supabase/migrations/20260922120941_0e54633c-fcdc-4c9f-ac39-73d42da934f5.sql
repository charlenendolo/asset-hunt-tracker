CREATE TABLE public.machine_search_terms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.machine_search_terms TO authenticated;
GRANT ALL ON public.machine_search_terms TO service_role;

ALTER TABLE public.machine_search_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view machine search terms"
  ON public.machine_search_terms FOR SELECT TO authenticated USING (true);

CREATE UNIQUE INDEX machine_search_terms_name_unique
  ON public.machine_search_terms (lower(name));

CREATE TABLE public.machine_search_term_assignments (
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.machine_search_terms(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (machine_id, term_id)
);

GRANT SELECT ON public.machine_search_term_assignments TO authenticated;
GRANT ALL ON public.machine_search_term_assignments TO service_role;

ALTER TABLE public.machine_search_term_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view machine search term assignments"
  ON public.machine_search_term_assignments FOR SELECT TO authenticated USING (true);

CREATE INDEX machine_search_term_assignments_term_idx
  ON public.machine_search_term_assignments (term_id);