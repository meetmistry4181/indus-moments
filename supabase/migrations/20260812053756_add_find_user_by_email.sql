/*
# Add find_user_by_email

Lets a club president look up a registered member by their university
email so they can add that person to their club's team, without granting
broad read access to the profiles table. Only returns a match if the
caller is themselves an approved (non-pending) member, and only returns
id/name/role — never the target's email back.
*/

create or replace function public.find_user_by_email(target_email text)
returns table(id uuid, full_name text, role text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.role from profiles p
  where is_approved() and lower(p.email) = lower(target_email);
$$;

revoke all on function public.find_user_by_email(text) from public;
revoke execute on function public.find_user_by_email(text) from anon;
grant execute on function public.find_user_by_email(text) to authenticated;
