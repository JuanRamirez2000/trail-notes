-- Make the access model explicit: these tables are server-only. With row-level security on and no
-- permissive policy, browser roles are already denied; these restrictive "false" policies say so
-- on purpose (and stop the advisor reporting "RLS enabled, no policy"). The service role, which
-- only the site's server holds, bypasses row-level security.
create policy "server only" on public.hikes          as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.hike_revisions as restrictive for all to anon, authenticated using (false) with check (false);
create policy "server only" on public.editors        as restrictive for all to anon, authenticated using (false) with check (false);
