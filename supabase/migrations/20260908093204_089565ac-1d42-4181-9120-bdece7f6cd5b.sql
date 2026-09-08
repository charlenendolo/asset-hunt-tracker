CREATE TABLE public.machine_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES public.profiles(id),
  to_user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at timestamptz,
  CONSTRAINT machine_handovers_status_check CHECK (status IN ('pending','accepted','rejected','withdrawn','expired')),
  CONSTRAINT machine_handovers_distinct_users CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX machine_handovers_one_pending
  ON public.machine_handovers (machine_id)
  WHERE status = 'pending';

CREATE INDEX machine_handovers_to_user_idx ON public.machine_handovers (to_user_id, status);
CREATE INDEX machine_handovers_machine_idx ON public.machine_handovers (machine_id, created_at DESC);

GRANT SELECT ON public.machine_handovers TO authenticated;
GRANT ALL ON public.machine_handovers TO service_role;

ALTER TABLE public.machine_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view handovers"
  ON public.machine_handovers FOR SELECT TO authenticated USING (true);

CREATE TRIGGER machine_handovers_set_updated_at
  BEFORE UPDATE ON public.machine_handovers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();