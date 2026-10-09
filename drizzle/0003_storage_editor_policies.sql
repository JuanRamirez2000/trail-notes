-- Photo files: let the people on the editors list add, list and delete objects in the "hikes"
-- bucket as themselves, so the site's photo routes can work with the signed-in editor's own
-- session instead of the service-role key. Reading stays as it was: the bucket is public.
--
-- The editors table is closed to browser roles ("server only"), so a storage policy can't look
-- in it directly. is_editor() does, as the table's owner, and answers one thing: whether the
-- caller is on the list. It gives nothing else away, and anon can't call it.
CREATE FUNCTION public.is_editor() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $$ select exists (select 1 from public.editors where user_id = (select auth.uid())) $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_editor() FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_editor() TO authenticated;--> statement-breakpoint
-- No UPDATE policy: an upload never replaces a file (a changed photo gets a new name).
CREATE POLICY "editors list hike photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'hikes' AND (select public.is_editor()));--> statement-breakpoint
CREATE POLICY "editors add hike photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hikes' AND (select public.is_editor()));--> statement-breakpoint
CREATE POLICY "editors delete hike photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hikes' AND (select public.is_editor()));
