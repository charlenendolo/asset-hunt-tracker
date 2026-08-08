create table public.employee_logins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  select_ref uuid not null unique default gen_random_uuid(),
  pin_hash text not null,
  pin_salt text not null,
  pin_set_at timestamptz not null default now(),
  pin_must_change boolean not null default true,
  failed_attempts integer not null default 0,
  lock_count integer not null default 0,
  locked_until timestamptz,
  last_success_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.employee_logins from anon, authenticated;
grant all on public.employee_logins to service_role;

alter table public.employee_logins enable row level security;

create trigger employee_logins_set_updated_at
  before update on public.employee_logins
  for each row execute function public.set_updated_at();