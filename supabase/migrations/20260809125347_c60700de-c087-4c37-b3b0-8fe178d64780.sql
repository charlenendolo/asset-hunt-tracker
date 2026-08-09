DROP FUNCTION IF EXISTS public.debug_effective_role();

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active)
     AND current_user <> 'service_role'
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Rolle und Status dürfen nur von Administratoren geändert werden.';
  END IF;
  RETURN NEW;
END;
$function$;