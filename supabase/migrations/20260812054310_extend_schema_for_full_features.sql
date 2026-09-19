/*
# Extend schema for full feature set

Adds the remaining columns and tables needed for the complete app:
- Profile fields: department, enrollment number, semester, year, designation, avatar
- Event fields: venue, category, photographer
- Favorites table for "My Best Photos" collections
- Notifications table for "You have been spotted" alerts
- Downloads tracking for admin reports
- Avatar storage bucket
- Admin stats function
*/

-- ============================================================
-- profiles: extend with student/faculty detail fields
-- ============================================================
alter table profiles add column if not exists department text default '';
alter table profiles add column if not exists enrollment_number text default '';
alter table profiles add column if not exists semester integer;
alter table profiles add column if not exists year integer;
alter table profiles add column if not exists designation text default '';
alter table profiles add column if not exists avatar_url text default '';

-- Allow users to update their own profile fields (but NOT role)
revoke update on profiles from authenticated;
grant update (full_name, department, enrollment_number, semester, year, designation, avatar_url) on profiles to authenticated;

-- ============================================================
-- events: extend with venue, category, photographer
-- ============================================================
alter table events add column if not exists venue text default '';
alter table events add column if not exists category text default 'General';
alter table events add column if not exists photographer text default '';

create index if not exists events_category_idx on events(category);
create index if not exists events_event_date_idx on events(event_date);

-- ============================================================
-- favorites: students can save photos to collections
-- ============================================================
create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, photo_id)
);

alter table favorites enable row level security;

create index if not exists favorites_user_id_idx on favorites(user_id);
create index if not exists favorites_photo_id_idx on favorites(photo_id);

drop policy if exists "favorites_select" on favorites;
create policy "favorites_select" on favorites for select
  to authenticated using (user_id = auth.uid());

drop policy if exists "favorites_insert" on favorites;
create policy "favorites_insert" on favorites for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "favorites_delete" on favorites;
create policy "favorites_delete" on favorites for delete
  to authenticated using (user_id = auth.uid());

-- ============================================================
-- notifications: "You have been spotted in TechFest 2026"
-- ============================================================
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  photo_id uuid references photos(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_unread_idx on notifications(user_id) where read = false;

drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select
  to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert
  to authenticated with check (user_id = auth.uid());

drop policy if exists "notifications_update" on notifications;
create policy "notifications_update" on notifications for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete" on notifications;
create policy "notifications_delete" on notifications for delete
  to authenticated using (user_id = auth.uid());

-- ============================================================
-- downloads_log: track downloads for admin reports
-- ============================================================
create table if not exists downloads_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  photo_id uuid references photos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table downloads_log enable row level security;

create index if not exists downloads_log_user_id_idx on downloads_log(user_id);
create index if not exists downloads_log_photo_id_idx on downloads_log(photo_id);

drop policy if exists "downloads_log_select" on downloads_log;
create policy "downloads_log_select" on downloads_log for select
  to authenticated using (user_id = auth.uid() or is_admin());

drop policy if exists "downloads_log_insert" on downloads_log;
create policy "downloads_log_insert" on downloads_log for insert
  to authenticated with check (user_id = auth.uid());

-- ============================================================
-- Storage: avatar bucket (public read, authenticated write to own folder)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Function: create_notification
-- ============================================================
create or replace function public.create_notification(
  p_user_id uuid,
  p_photo_id uuid,
  p_event_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;
  insert into notifications (user_id, photo_id, event_id, message)
  values (p_user_id, p_photo_id, p_event_id, p_message);
end;
$$;

revoke all on function public.create_notification(uuid, uuid, uuid, text) from public;
revoke execute on function public.create_notification(uuid, uuid, uuid, text) from anon;
grant execute on function public.create_notification(uuid, uuid, uuid, text) to authenticated;

-- ============================================================
-- Function: get_admin_stats (for admin dashboard)
-- ============================================================
create or replace function public.get_admin_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;

  select json_build_object(
    'total_users', (select count(*) from profiles),
    'students', (select count(*) from profiles where role = 'student'),
    'faculty', (select count(*) from profiles where role = 'faculty'),
    'pending', (select count(*) from profiles where role = 'pending'),
    'admins', (select count(*) from profiles where role = 'admin'),
    'clubs', (select count(*) from clubs),
    'events', (select count(*) from events),
    'photos', (select count(*) from photos),
    'downloads', (select count(*) from downloads_log),
    'face_encodings', (select count(*) from face_encodings),
    'favorites', (select count(*) from favorites)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_stats() from public;
revoke execute on function public.get_admin_stats() from anon;
grant execute on function public.get_admin_stats() to authenticated;
