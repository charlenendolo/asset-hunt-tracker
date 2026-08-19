DO $$
DECLARE
  kabel uuid; gross uuid; sonst uuid;
BEGIN
  SELECT id INTO kabel FROM public.machine_categories WHERE name = 'Kabelgebunden';
  SELECT id INTO gross FROM public.machine_categories WHERE name = 'Großgeräte';
  SELECT id INTO sonst FROM public.machine_categories WHERE name = 'Sonstiges';

  UPDATE public.machines m SET category_id = kabel
  FROM public.machine_categories c
  WHERE m.category_id = c.id
    AND c.name IN ('Bohrmaschinen','Schleifmaschinen','Staubsauger','Handwerkzeuge','Reinigungsgeräte','Farbspritzmaschinen');

  UPDATE public.machines m SET category_id = gross
  FROM public.machine_categories c
  WHERE m.category_id = c.id
    AND c.name IN ('Betonspritzmaschinen','Kompressoren','Stemmhämmer','Injektionstechnik','Stromversorgung','Leitern und Gerüste');

  UPDATE public.machines m SET category_id = sonst
  FROM public.machine_categories c
  WHERE m.category_id = c.id
    AND c.name NOT IN ('Kabelgebunden','Akkubasiert','Großgeräte','Prüfgeräte','Sonstiges');

  DELETE FROM public.machine_categories
  WHERE name NOT IN ('Kabelgebunden','Akkubasiert','Großgeräte','Prüfgeräte','Sonstiges');

  UPDATE public.machine_categories SET active = true
  WHERE name IN ('Kabelgebunden','Akkubasiert','Großgeräte','Prüfgeräte','Sonstiges');
END $$;