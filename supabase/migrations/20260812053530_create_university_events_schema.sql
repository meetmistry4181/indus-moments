/*
# Indus University Event Photos — core schema

## Overview
Sets up the full data model for a university-only event photo platform:
sign-in restricted to approved members, clubs with a president + team who
can upload event photos, faculty who can also upload, and a face-matching
system so a student can find every photo they appear in from a selfie.

## New tables
1. `profiles` — one row per signed-in person. Holds `role` which is
   'pending' (default, awaiting approval), 'student', 'faculty', or
   'admin'. Every new sign-up starts as 'pending' except the very first
   account ever created, which is auto-promoted to 'admin' so someone can
   run the approval panel.
2. `clubs` — the list of university clubs/societies that host events.
3. `club_members` — who belongs to which club and whether they are the
   'president' or a 'member' (team member). Both roles may upload photos
   for that club; only the president/admin can manage the roster.
4. `events` — a specific event held by a club (title, description, date).
5. `photos` — an uploaded event photo (points at a file in storage).
6. `face_encodings` — one row per face detected inside a photo, storing a
   128-number face signature (not the face image itself) used for
   matching. Not directly readable by any client — only reachable through
   the `match_faces` function below.
7. `selfie_embeddings` — a private, per-user cache of the signature
   computed from a person's own selfie, so they don't need to retake it
   every visit. Only the owning user can ever read or write their row —
   not even admins.

## Security
- Row Level Security is enabled on every table above.
- `profiles.role` cannot be changed by a normal update (column-level
  privilege is revoked); role changes only happen through the
  `admin_set_user_role` function, which itself checks the caller is an
  admin. This prevents anyone from promoting themselves.
- Helper functions `my_role()`, `is_admin()`, `is_approved()` read only
  the calling user's own role and are used across policies to avoid
  recursive policy checks.
- `club_members` inserts/updates require the caller to already be the
  club's president (or an admin) — so nobody can add themselves to a
  club's team.
- `match_faces` is a function (not a raw table read) so face signatures
  are never exposed to clients directly; it only returns which photo ids
  matched and how closely.
- Storage: a private `event-photos` bucket is created. Uploads are only
  allowed into a `{club_id}/{event_id}/...` path by a member of that club
  (or faculty/admin). Any approved (non-pending) signed-in user can read
  photos, since browsing the shared gallery is the whole point of the
  app.
*/

-- Extension needed for face-signature matching
create extension if not exists vector;

-- ============================================================
-- profiles
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'pending' check (role in ('pending', 'student', 'faculty', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Auto-create a profile row whenever someone signs up.
-- The very first account ever created becomes admin; everyone after starts pending.
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
  else
    assigned_role := 'pending';
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper functions (each reads only the caller's own row, so they are
-- safe to call from other tables' policies without recursion)
create or replace function public.my_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.my_role() = 'admin', false);
$$;

create or replace function public.is_approved()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.my_role() in ('student', 'faculty', 'admin'), false);
$$;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  to authenticated
  using (auth.uid() = id or is_admin());

drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update
  to authenticated
  using (auth.uid() = id or is_admin())
  with check (auth.uid() = id or is_admin());

-- Row policy alone would let a user rewrite their own role; lock that
-- column down at the grant level so only privileged functions can set it.
revoke update on profiles from authenticated;
grant update (full_name) on profiles to authenticated;

-- Privileged role changes go through this function only.
create or replace function public.admin_set_user_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized';
  end if;
  if new_role not in ('pending', 'student', 'faculty', 'admin') then
    raise exception 'Invalid role';
  end if;
  update profiles set role = new_role where id = target_user;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Lets any approved user resolve a display name for "uploaded by" labels
-- without granting broad read access to the profiles table (no email exposed).
create or replace function public.get_profile_names(user_ids uuid[])
returns table(id uuid, full_name text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name from profiles p
  where p.id = any(user_ids) and is_approved();
$$;

revoke all on function public.get_profile_names(uuid[]) from public;
grant execute on function public.get_profile_names(uuid[]) to authenticated;

-- ============================================================
-- clubs
-- ============================================================
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table clubs enable row level security;

drop policy if exists "clubs_select" on clubs;
create policy "clubs_select" on clubs for select
  to authenticated
  using (is_approved());

drop policy if exists "clubs_insert" on clubs;
create policy "clubs_insert" on clubs for insert
  to authenticated
  with check (is_admin());

drop policy if exists "clubs_update" on clubs;
create policy "clubs_update" on clubs for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists "clubs_delete" on clubs;
create policy "clubs_delete" on clubs for delete
  to authenticated
  using (is_admin());

-- ============================================================
-- club_members
-- ============================================================
create table if not exists club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_role text not null default 'member' check (club_role in ('president', 'member')),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

alter table club_members enable row level security;

create index if not exists club_members_club_id_idx on club_members(club_id);
create index if not exists club_members_user_id_idx on club_members(user_id);

drop policy if exists "club_members_select" on club_members;
create policy "club_members_select" on club_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from club_members me
      where me.club_id = club_members.club_id and me.user_id = auth.uid()
    )
  );

drop policy if exists "club_members_insert" on club_members;
create policy "club_members_insert" on club_members for insert
  to authenticated
  with check (
    is_admin()
    or exists (
      select 1 from club_members me
      where me.club_id = club_members.club_id
        and me.user_id = auth.uid()
        and me.club_role = 'president'
    )
  );

drop policy if exists "club_members_update" on club_members;
create policy "club_members_update" on club_members for update
  to authenticated
  using (
    is_admin()
    or exists (
      select 1 from club_members me
      where me.club_id = club_members.club_id
        and me.user_id = auth.uid()
        and me.club_role = 'president'
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from club_members me
      where me.club_id = club_members.club_id
        and me.user_id = auth.uid()
        and me.club_role = 'president'
    )
  );

drop policy if exists "club_members_delete" on club_members;
create policy "club_members_delete" on club_members for delete
  to authenticated
  using (
    user_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from club_members me
      where me.club_id = club_members.club_id
        and me.user_id = auth.uid()
        and me.club_role = 'president'
    )
  );

-- ============================================================
-- events
-- ============================================================
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  title text not null,
  description text not null default '',
  event_date date not null default current_date,
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create index if not exists events_club_id_idx on events(club_id);

drop policy if exists "events_select" on events;
create policy "events_select" on events for select
  to authenticated
  using (is_approved());

drop policy if exists "events_insert" on events;
create policy "events_insert" on events for insert
  to authenticated
  with check (
    is_admin()
    or my_role() = 'faculty'
    or exists (
      select 1 from club_members cm
      where cm.club_id = events.club_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "events_update" on events;
create policy "events_update" on events for update
  to authenticated
  using (
    is_admin()
    or my_role() = 'faculty'
    or exists (
      select 1 from club_members cm
      where cm.club_id = events.club_id and cm.user_id = auth.uid()
    )
  )
  with check (
    is_admin()
    or my_role() = 'faculty'
    or exists (
      select 1 from club_members cm
      where cm.club_id = events.club_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "events_delete" on events;
create policy "events_delete" on events for delete
  to authenticated
  using (
    is_admin()
    or created_by = auth.uid()
  );

-- ============================================================
-- photos
-- ============================================================
create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table photos enable row level security;

create index if not exists photos_event_id_idx on photos(event_id);

drop policy if exists "photos_select" on photos;
create policy "photos_select" on photos for select
  to authenticated
  using (is_approved());

drop policy if exists "photos_insert" on photos;
create policy "photos_insert" on photos for insert
  to authenticated
  with check (
    is_admin()
    or my_role() = 'faculty'
    or exists (
      select 1 from club_members cm
      join events e on e.club_id = cm.club_id
      where e.id = photos.event_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "photos_delete" on photos;
create policy "photos_delete" on photos for delete
  to authenticated
  using (
    is_admin()
    or uploaded_by = auth.uid()
  );

-- ============================================================
-- face_encodings (never directly selectable by clients)
-- ============================================================
create table if not exists face_encodings (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photos(id) on delete cascade,
  embedding vector(128) not null,
  created_at timestamptz not null default now()
);

alter table face_encodings enable row level security;

create index if not exists face_encodings_photo_id_idx on face_encodings(photo_id);

drop policy if exists "face_encodings_insert" on face_encodings;
create policy "face_encodings_insert" on face_encodings for insert
  to authenticated
  with check (
    is_admin()
    or my_role() = 'faculty'
    or exists (
      select 1 from club_members cm
      join events e on e.club_id = cm.club_id
      join photos p on p.event_id = e.id
      where p.id = face_encodings.photo_id and cm.user_id = auth.uid()
    )
  );

drop policy if exists "face_encodings_delete" on face_encodings;
create policy "face_encodings_delete" on face_encodings for delete
  to authenticated
  using (
    is_admin()
    or exists (select 1 from photos p where p.id = face_encodings.photo_id and p.uploaded_by = auth.uid())
  );

-- Matching happens only through this function so raw face signatures are
-- never exposed to any client.
create or replace function public.match_faces(query_embedding vector(128), max_distance float default 0.5)
returns table(photo_id uuid, distance float)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_approved() then
    raise exception 'Not authorized';
  end if;

  return query
    select fe.photo_id, min(fe.embedding <-> query_embedding) as distance
    from face_encodings fe
    where fe.embedding <-> query_embedding < max_distance
    group by fe.photo_id
    order by distance asc;
end;
$$;

revoke all on function public.match_faces(vector, float) from public;
grant execute on function public.match_faces(vector, float) to authenticated;

-- ============================================================
-- selfie_embeddings (fully private cache, not even admins can read it)
-- ============================================================
create table if not exists selfie_embeddings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  embedding vector(128) not null,
  updated_at timestamptz not null default now()
);

alter table selfie_embeddings enable row level security;

drop policy if exists "selfie_embeddings_select" on selfie_embeddings;
create policy "selfie_embeddings_select" on selfie_embeddings for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "selfie_embeddings_insert" on selfie_embeddings;
create policy "selfie_embeddings_insert" on selfie_embeddings for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "selfie_embeddings_update" on selfie_embeddings;
create policy "selfie_embeddings_update" on selfie_embeddings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "selfie_embeddings_delete" on selfie_embeddings;
create policy "selfie_embeddings_delete" on selfie_embeddings for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- storage: private bucket for event photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', false)
on conflict (id) do nothing;

drop policy if exists "event_photos_select" on storage.objects;
create policy "event_photos_select" on storage.objects for select
  to authenticated
  using (bucket_id = 'event-photos' and is_approved());

drop policy if exists "event_photos_insert" on storage.objects;
create policy "event_photos_insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-photos'
    and (
      is_admin()
      or my_role() = 'faculty'
      or exists (
        select 1 from club_members cm
        where cm.club_id::text = (storage.foldername(name))[1]
          and cm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "event_photos_delete" on storage.objects;
create policy "event_photos_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-photos' and (owner = auth.uid() or is_admin()));
