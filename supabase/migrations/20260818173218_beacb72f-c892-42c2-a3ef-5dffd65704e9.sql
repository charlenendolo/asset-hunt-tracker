ALTER TABLE public.machine_categories
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

INSERT INTO public.machine_categories (name)
SELECT v.name
FROM (VALUES ('Kabelgebunden'), ('Akkubasiert'), ('Großgeräte'), ('Prüfgeräte'), ('Sonstiges')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.machine_categories c WHERE lower(c.name) = lower(v.name)
);

UPDATE public.machine_categories
SET active = (lower(name) IN ('kabelgebunden', 'akkubasiert', 'großgeräte', 'prüfgeräte', 'sonstiges'));