-- The guide store does every change in a Drizzle transaction now (src/lib/store/postgres.ts);
-- the supabase-js store that called these was removed, so nothing calls them.
DROP FUNCTION IF EXISTS public.save_hike(text, text, json, json, jsonb, text, integer, uuid, text);--> statement-breakpoint
DROP FUNCTION IF EXISTS public.create_hike(text, text, json, json, jsonb, text, uuid, text);
