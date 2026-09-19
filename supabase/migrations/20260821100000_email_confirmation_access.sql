/*
  Email confirmation is the access gate. New users choose their account type
  during signup instead of waiting for an administrator to approve them.
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  if (select count(*) from public.profiles) = 0 then
    assigned_role := 'admin';
  elsif new.raw_user_meta_data->>'role' in ('student', 'faculty') then
    assigned_role := new.raw_user_meta_data->>'role';
  else
    assigned_role := 'student';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    assigned_role
  );
  return new;
end;
$$;

update public.profiles
set role = 'student'
where role = 'pending';

create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid());
$$;

drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events for select
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid()));