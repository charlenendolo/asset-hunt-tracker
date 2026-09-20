ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_vehicle_site_id_idx ON public.profiles (vehicle_site_id);

DROP FUNCTION IF EXISTS public.current_profile();

CREATE FUNCTION public.current_profile()
 RETURNS TABLE(id uuid, full_name text, role text, active boolean, created_at timestamp with time zone, vehicle_site_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.id, p.full_name, p.role, p.active, p.created_at, p.vehicle_site_id
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  request_role text;
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.active IS DISTINCT FROM OLD.active
      OR NEW.vehicle_site_id IS DISTINCT FROM OLD.vehicle_site_id) THEN
    request_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
      ''
    );
    IF request_role <> 'service_role' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Rolle, Status und Fahrzeugzuordnung dürfen nur von Administratoren geändert werden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;