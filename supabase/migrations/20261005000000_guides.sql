-- Trailnotes V2 E2.2: guides, their history, and who may edit them.
--
-- Access model: only the site's server (the service role) reads or writes these tables.
-- Row-level security is on with NO policies, so the public key and signed-in browser sessions
-- can do nothing here: no reading drafts, no writing around the app's save gate.

create table public.hikes (
  slug             text primary key check (slug ~ '^[a-z0-9-]+$'),
  mdx              text        not null,                       -- the guide: frontmatter + MDX body
  waypoints        jsonb       not null,                       -- { "waypoints": [...] }
  track            jsonb,                                      -- recorded route: positions and elevation only
  details          jsonb       not null,                       -- validated frontmatter, for lists
  status           text        not null check (status in ('draft', 'published')),
  version          integer     not null default 1,             -- bumped on every save; saves must name the version they're based on
  updated_by       uuid,                                       -- auth user id, null for scripts
  updated_by_label text,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table public.hike_revisions (
  id             bigint generated always as identity primary key,
  slug           text        not null,                         -- no foreign key: history outlives a deleted hike
  version        integer     not null,
  mdx            text        not null,
  waypoints      jsonb       not null,
  status         text        not null,
  saved_by       uuid,
  saved_by_label text,
  saved_at       timestamptz not null default now(),
  unique (slug, version)
);
create index hike_revisions_slug_idx on public.hike_revisions (slug, version desc);

-- People allowed to use the editor. Being signed in is not enough: the app looks you up here.
create table public.editors (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text        not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now()
);

alter table public.hikes          enable row level security;
alter table public.hike_revisions enable row level security;
alter table public.editors        enable row level security;

revoke all on public.hikes, public.hike_revisions, public.editors from anon, authenticated;

-- Save a change, only if the hike is still at the version the change was based on.
-- The update and its history row happen together or not at all.
create function public.save_hike(
  p_slug text, p_mdx text, p_waypoints jsonb, p_track jsonb, p_details jsonb, p_status text,
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
  p_slug text, p_mdx text, p_waypoints jsonb, p_track jsonb, p_details jsonb, p_status text,
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

revoke all on function public.save_hike(text, text, jsonb, jsonb, jsonb, text, integer, uuid, text)   from public, anon, authenticated;
revoke all on function public.create_hike(text, text, jsonb, jsonb, jsonb, text, uuid, text)          from public, anon, authenticated;
grant execute on function public.save_hike(text, text, jsonb, jsonb, jsonb, text, integer, uuid, text) to service_role;
grant execute on function public.create_hike(text, text, jsonb, jsonb, jsonb, text, uuid, text)        to service_role;

-- Supabase's helper that switches row-level security on for new tables. It only makes sense as an
-- event trigger; nobody needs to call it over the API (advisor warnings 0028/0029).
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
