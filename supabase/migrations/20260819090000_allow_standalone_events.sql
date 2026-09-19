-- The upload workflow supports university-wide events without a club.
alter table public.events alter column club_id drop not null;