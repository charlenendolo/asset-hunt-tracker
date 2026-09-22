ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['user'::text, 'site_manager'::text, 'warehouse_manager'::text, 'admin'::text, 'superadmin'::text]));

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'superadmin'
      and active = true
  );
$function$;

-- Superadmin erbt alle Administrator-Rechte (RLS-Policies nutzen is_admin()).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'superadmin')
      and active = true
  );
$function$;

-- Eigentümerkonto einmalig hochstufen (Schutztrigger kurz ausgesetzt).
ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;
UPDATE public.profiles SET role = 'superadmin'
WHERE id = '4fc26fa0-e99d-4164-b35e-88f8f65243e4';
ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;

-- Privilegierte Spalten nur noch über geprüfte Serverabläufe (service_role).
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
    IF request_role <> 'service_role' THEN
      RAISE EXCEPTION 'Rolle, Status und Fahrzeugzuordnung dürfen nur über die Benutzerverwaltung geändert werden.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;