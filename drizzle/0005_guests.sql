CREATE TABLE "hike_guests" (
	"slug" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hike_guests_slug_user_id_pk" PRIMARY KEY("slug","user_id")
);
--> statement-breakpoint
ALTER TABLE "hike_guests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "editors" DROP CONSTRAINT "editors_role_check";--> statement-breakpoint
ALTER TABLE "hike_guests" ADD CONSTRAINT "hike_guests_slug_hikes_slug_fk" FOREIGN KEY ("slug") REFERENCES "public"."hikes"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hike_guests" ADD CONSTRAINT "hike_guests_user_id_editors_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."editors"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editors" ADD CONSTRAINT "editors_role_check" CHECK ("editors"."role" = ANY (ARRAY['owner'::text, 'editor'::text, 'guest'::text]));--> statement-breakpoint
CREATE POLICY "server only" ON "hike_guests" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);