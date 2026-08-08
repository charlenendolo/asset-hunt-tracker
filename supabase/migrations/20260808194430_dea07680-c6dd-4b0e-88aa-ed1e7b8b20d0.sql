-- 1. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. SECURITY DEFINER functions must not be callable from the API unless required
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated; -- required by RLS policies

-- 3. employee_logins: PIN hashes reachable only by trusted server code
REVOKE ALL ON TABLE public.employee_logins FROM anon, authenticated;
GRANT ALL ON TABLE public.employee_logins TO service_role;

-- 4. movements: history is append-only, enforce at privilege level too
REVOKE UPDATE, DELETE ON TABLE public.movements FROM anon, authenticated;

-- 5. profiles: no broad exposure of role/active to every signed-in user
REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, created_at) ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- Own role/status stays available to the signed-in user only
CREATE OR REPLACE FUNCTION public.current_profile()
RETURNS TABLE (id uuid, full_name text, role text, active boolean, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.full_name, p.role, p.active, p.created_at
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.current_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile() TO authenticated;