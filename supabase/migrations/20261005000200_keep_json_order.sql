-- Pins and the track are stored as `json`, not `jsonb`: jsonb reorders object keys, which made
-- stored pins read back with their fields shuffled (noisy diffs in the editor's JSON view and in
-- `pnpm content pull`). Nothing queries inside these columns, so jsonb's indexing isn't needed.
-- `details` stays jsonb: it's derived data for lists, and may be filtered on later.
alter table public.hikes          alter column waypoints type json using waypoints::json;
alter table public.hikes          alter column track     type json using track::json;
alter table public.hike_revisions alter column waypoints type json using waypoints::json;

drop function public.save_hike(text, text, jsonb, jsonb, jsonb, text, integer, uuid, text);
drop function public.create_hike(text, text, jsonb, jsonb, jsonb, text, uuid, text);

create function public.save_hike(
  p_slug text, p_mdx text, p_waypoints json, p_track json, p_details jsonb, p_status text,
  p_base_version integer, p_editor uuid, p_editor_label text
) returns table (result text, version integer)
language plpgsql security invoker set search_path = ''
as $$
declare
  v integer;
begin
  update public.hikes h
     set mdx = p_mdx, waypoints = p_waypoints, track = p_track, details = p_details, status = p_status,
         version = h.version + 1, updated_by = p_editor, updated_by_label = p_editor_label, updated_at = now()
   where h.slug = p_slug and h.version = p_base_version
  returning h.version into v;

  if found then
    insert into public.hike_revisions (slug, version, mdx, waypoints, status, saved_by, saved_by_label)
    values (p_slug, v, p_mdx, p_waypoints, p_status, p_editor, p_editor_label);
    return query select 'ok'::text, v;
    return;
  end if;

  select h.version into v from public.hikes h where h.slug = p_slug;
  if found then
    return query select 'conflict'::text, v;
  else
    return query select 'not_found'::text, null::integer;
  end if;
end;
$$;

create function public.create_hike(
  p_slug text, p_mdx text, p_waypoints json, p_track json, p_details jsonb, p_status text,
  p_editor uuid, p_editor_label text
) returns table (result text, version integer)
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.hikes (slug, mdx, waypoints, track, details, status, updated_by, updated_by_label)
  values (p_slug, p_mdx, p_waypoints, p_track, p_details, p_status, p_editor, p_editor_label)
  on conflict (slug) do nothing;

  if not found then
    return query select 'exists'::text, null::integer;
    return;
  end if;

  insert into public.hike_revisions (slug, version, mdx, waypoints, status, saved_by, saved_by_label)
  values (p_slug, 1, p_mdx, p_waypoints, p_status, p_editor, p_editor_label);
  return query select 'ok'::text, 1;
end;
$$;

revoke all on function public.save_hike(text, text, json, json, jsonb, text, integer, uuid, text)   from public, anon, authenticated;
revoke all on function public.create_hike(text, text, json, json, jsonb, text, uuid, text)          from public, anon, authenticated;
grant execute on function public.save_hike(text, text, json, json, jsonb, text, integer, uuid, text) to service_role;
grant execute on function public.create_hike(text, text, json, json, jsonb, text, uuid, text)        to service_role;
