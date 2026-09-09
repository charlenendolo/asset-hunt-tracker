ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9._-]{3,32}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

GRANT SELECT (username) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.account_has_password(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id
      AND u.encrypted_password IS NOT NULL
      AND u.encrypted_password <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.account_has_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_has_password(uuid) TO service_role;