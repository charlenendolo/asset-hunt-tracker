ALTER TABLE public.sites
  ADD COLUMN location_type text NOT NULL DEFAULT 'baustelle';

ALTER TABLE public.sites
  ADD CONSTRAINT sites_location_type_check
  CHECK (location_type IN ('baustelle','fahrzeug','lager','werkstatt','sonstiges'));

CREATE INDEX sites_location_type_idx
  ON public.sites (location_type);