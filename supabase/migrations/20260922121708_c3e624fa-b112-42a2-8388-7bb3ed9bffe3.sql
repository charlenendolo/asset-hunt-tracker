-- 1) profiles: Zeilen bleiben lesbar (Namen für Suche/Anzeige), aber nur die
--    operativ benötigten Spalten.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, full_name, username, role, active, vehicle_site_id)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2) machine_handovers: nur Beteiligte und Admin/Superadmin
DROP POLICY IF EXISTS "Authenticated users can view handovers" ON public.machine_handovers;
CREATE POLICY "Participants and admins can view handovers"
  ON public.machine_handovers FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR from_user_id = (SELECT auth.uid())
    OR to_user_id = (SELECT auth.uid())
  );

-- 3) movements: Admin/Superadmin, eigene Vorgänge, Geräte in eigener Obhut
DROP POLICY IF EXISTS "Authenticated users can view movements" ON public.movements;
CREATE POLICY "Own and admin movements are visible"
  ON public.movements FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR performed_by = (SELECT auth.uid())
    OR responsible_user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.machines m
      WHERE m.id = movements.machine_id
        AND m.responsible_user_id = (SELECT auth.uid())
    )
  );
