-- Student club-role requests use existing club_members rows and require admin approval.
alter table public.club_members
  add column if not exists status text not null default 'approved';

alter table public.club_members
  drop constraint if exists club_members_club_role_check;

alter table public.club_members
  add constraint club_members_club_role_check
  check (club_role in ('president', 'photographer', 'member'));

alter table public.club_members
  drop constraint if exists club_members_status_check;

alter table public.club_members
  add constraint club_members_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- Only an admin may approve or reject a membership. Existing non-status membership
-- edits remain available, but status changes are blocked for non-admin callers.
create or replace function public.prevent_non_admin_membership_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and not public.is_admin() then
    raise exception 'Only an administrator can approve or reject club roles';
  end if;
  return new;
end;
$$;

drop trigger if exists club_members_status_guard on public.club_members;
create trigger club_members_status_guard
before update on public.club_members
for each row execute function public.prevent_non_admin_membership_status_change();

-- Signup can safely read club names before an authenticated session exists.
create or replace function public.list_signup_clubs()
returns table (id uuid, name text, description text, created_by uuid, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.description, c.created_by, c.created_at
  from public.clubs c
  order by c.name;
$$;

grant execute on function public.list_signup_clubs() to anon, authenticated;

-- Signup metadata creates a pending request, never an approved upload role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  requested_club_role text;
  requested_club_id_text text;
  requested_club_id uuid;
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

  requested_club_role := new.raw_user_meta_data->>'club_role';
  requested_club_id_text := nullif(new.raw_user_meta_data->>'club_id', '');
  if requested_club_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    requested_club_id := requested_club_id_text::uuid;
  end if;

  if assigned_role = 'student'
    and requested_club_role in ('president', 'photographer')
    and requested_club_id is not null
  then
    insert into public.club_members (club_id, user_id, club_role, status)
    select requested_club_id, new.id, requested_club_role, 'pending'
    where exists (select 1 from public.clubs where id = requested_club_id)
    on conflict (club_id, user_id) do update
      set club_role = excluded.club_role, status = 'pending';
  end if;

  return new;
end;
$$;

create or replace function public.admin_set_club_member_status(
  target_membership uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can approve club roles';
  end if;
  if new_status not in ('approved', 'rejected') then
    raise exception 'Invalid club role status';
  end if;
  update public.club_members
  set status = new_status
  where id = target_membership
    and club_role in ('president', 'photographer');
end;
$$;

revoke all on function public.admin_set_club_member_status(uuid, text) from public;
grant execute on function public.admin_set_club_member_status(uuid, text) to authenticated;

-- Keep gallery reads unchanged, but require approved upload roles for writes.
drop policy if exists "events_insert" on public.events;
create policy "events_insert" on public.events for insert
to authenticated
with check (
  public.is_admin()
  or public.my_role() = 'faculty'
  or exists (
    select 1 from public.club_members cm
    where cm.user_id = auth.uid()
      and cm.club_id = events.club_id
      and cm.club_role in ('president', 'photographer')
      and cm.status = 'approved'
  )
);

drop policy if exists "photos_insert" on public.photos;
create policy "photos_insert" on public.photos for insert
to authenticated
with check (
  public.is_admin()
  or public.my_role() = 'faculty'
  or exists (
    select 1
    from public.club_members cm
    join public.events e on e.club_id = cm.club_id
    where e.id = photos.event_id
      and cm.user_id = auth.uid()
      and cm.club_role in ('president', 'photographer')
      and cm.status = 'approved'
  )
);

drop policy if exists "event_photos_insert" on storage.objects;
create policy "event_photos_insert" on storage.objects for insert
to authenticated
with check (
  bucket_id = 'event-photos'
  and (
    public.is_admin()
    or public.my_role() = 'faculty'
    or exists (
      select 1 from public.club_members cm
      where cm.club_id::text = (storage.foldername(name))[1]
        and cm.user_id = auth.uid()
        and cm.club_role in ('president', 'photographer')
        and cm.status = 'approved'
    )
  )
);
