-- Keep the normal thresholded search first. If a pose or lighting change puts
-- the same person just outside the threshold, return only the two nearest
-- candidates within a conservative fallback distance.
create or replace function public.match_faces(query_embedding vector(128), max_distance float default 0.5)
returns table(photo_id uuid, distance float)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  matching_count integer;
begin
  if not is_approved() then
    raise exception 'Not authorized';
  end if;

  select count(*)::integer into matching_count
  from (
    select distinct fe.photo_id
    from face_encodings fe
    where fe.embedding <-> query_embedding < max_distance
  ) matches;

  if max_distance >= 1.05 then
    return query
      select fe.photo_id, min(fe.embedding <-> query_embedding) as distance
      from face_encodings fe
      group by fe.photo_id
      having min(fe.embedding <-> query_embedding) <= 1.05
      order by distance asc
      limit 2;
  elsif matching_count > 0 then
    return query
      select fe.photo_id, min(fe.embedding <-> query_embedding) as distance
      from face_encodings fe
      where fe.embedding <-> query_embedding < max_distance
      group by fe.photo_id
      order by distance asc;
  else
    return query
      select fe.photo_id, min(fe.embedding <-> query_embedding) as distance
      from face_encodings fe
      group by fe.photo_id
      having min(fe.embedding <-> query_embedding) <= greatest(max_distance, 1.05)
      order by distance asc
      limit 2;
  end if;
end;
$$;

revoke all on function public.match_faces(vector, float) from public;
grant execute on function public.match_faces(vector, float) to authenticated;
