create or replace function public.can_manage_inventory()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'superadmin', 'warehouse_manager')
      and active = true
  );
$$;

drop policy if exists "Users can update their reservations" on public.reservations;
create policy "Users can update their reservations"
on public.reservations
for update
to authenticated
using ((reserved_by = (select auth.uid())) or public.can_manage_inventory())
with check ((reserved_by = (select auth.uid())) or public.can_manage_inventory());

drop policy if exists "Admins delete reservations" on public.reservations;
create policy "Admins delete reservations"
on public.reservations
for delete
to authenticated
using (public.can_manage_inventory());