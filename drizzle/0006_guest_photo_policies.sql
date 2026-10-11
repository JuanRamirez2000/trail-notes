-- Photo files, now that there are guests: a guest may add, list and delete photos only in the
-- folders of their own hikes. Until now the policies asked "is this person on the editors list"
-- (is_editor), which would let a guest delete any hike's photos by calling storage directly.
--
-- can_edit_hike(slug) answers for one hike: yes for an owner or editor, and for a guest whose
-- hikes include it. Like is_editor it runs as the tables' owner (both tables are closed to
-- browser roles), gives away nothing but yes or no, and anon can't call it.
CREATE FUNCTION public.can_edit_hike(hike text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $$
    select exists (
      select 1 from public.editors e
      where e.user_id = (select auth.uid())
        and (e.role in ('owner', 'editor')
          or exists (select 1 from public.hike_guests g where g.user_id = e.user_id and g.slug = hike))
    )
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.can_edit_hike(text) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.can_edit_hike(text) TO authenticated;--> statement-breakpoint
-- A photo's hike is the first folder of its path: "<slug>/<NN>-<name>.full.webp".
DROP POLICY "editors list hike photos" ON storage.objects;--> statement-breakpoint
DROP POLICY "editors add hike photos" ON storage.objects;--> statement-breakpoint
DROP POLICY "editors delete hike photos" ON storage.objects;--> statement-breakpoint
CREATE POLICY "hike editors list its photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'hikes' AND (select public.can_edit_hike(split_part(name, '/', 1))));--> statement-breakpoint
CREATE POLICY "hike editors add its photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'hikes' AND (select public.can_edit_hike(split_part(name, '/', 1))));--> statement-breakpoint
CREATE POLICY "hike editors delete its photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'hikes' AND (select public.can_edit_hike(split_part(name, '/', 1))));
