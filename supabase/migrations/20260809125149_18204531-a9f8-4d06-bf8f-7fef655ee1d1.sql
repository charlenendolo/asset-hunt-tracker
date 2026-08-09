CREATE OR REPLACE FUNCTION public.debug_effective_role()
RETURNS TABLE(cur_user text, sess_user text, jwt_role text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT current_user::text,
         session_user::text,
         coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '')::text;
$$;

REVOKE ALL ON FUNCTION public.debug_effective_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debug_effective_role() TO service_role;