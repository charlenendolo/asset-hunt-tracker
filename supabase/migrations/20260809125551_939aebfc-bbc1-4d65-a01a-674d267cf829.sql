CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  request_role text;
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active) THEN
    request_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
      ''
    );
    IF request_role <> 'service_role' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Rolle und Status dürfen nur von Administratoren geändert werden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;