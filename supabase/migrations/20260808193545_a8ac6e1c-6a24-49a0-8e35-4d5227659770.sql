ALTER TABLE public.machines ADD COLUMN expected_return_at timestamptz;
ALTER TABLE public.movements ADD COLUMN expected_return_at timestamptz;