/*
# Tighten function execute grants

The previous migration's `revoke ... from public` did not remove the
`anon` role's execute privilege, because Supabase grants execute on new
functions to `anon` and `authenticated` directly. This migration revokes
execute from roles that should never call these functions:

- `handle_new_user` is a trigger-only function; no role should call it directly.
- `is_admin`, `is_approved`, `my_role` are only used inside RLS policies
  evaluated as `authenticated`; `anon` never needs them (no policy in this
  schema is scoped to `anon`).
- `admin_set_user_role`, `get_profile_names`, `match_faces` are meant to
  be called directly by signed-in users only, never by anonymous callers.

No behavior changes for signed-in users; each function still performs its
own internal authorization check regardless of grants.
*/

revoke execute on function public.handle_new_user() from anon, authenticated, public;

revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_approved() from anon;
revoke execute on function public.my_role() from anon;

revoke execute on function public.admin_set_user_role(uuid, text) from anon;
revoke execute on function public.get_profile_names(uuid[]) from anon;
revoke execute on function public.match_faces(vector, float) from anon;
