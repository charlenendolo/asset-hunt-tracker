-- Data API grants (RLS policies remain the effective access control).
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_categories TO authenticated;
GRANT ALL ON public.machine_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accessories TO authenticated;
GRANT ALL ON public.accessories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_photos TO authenticated;
GRANT ALL ON public.machine_photos TO service_role;

GRANT SELECT ON public.machine_properties TO authenticated;
GRANT ALL ON public.machine_properties TO service_role;

GRANT SELECT ON public.machine_property_assignments TO authenticated;
GRANT ALL ON public.machine_property_assignments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance TO authenticated;
GRANT ALL ON public.maintenance TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.defects TO authenticated;
GRANT ALL ON public.defects TO service_role;

GRANT SELECT, INSERT ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;

GRANT SELECT ON public.machine_handovers TO authenticated;
GRANT ALL ON public.machine_handovers TO service_role;

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

-- No policies exist for employee_logins: server-side access only.
GRANT ALL ON public.employee_logins TO service_role;