CREATE TABLE "editors" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editors_role_check" CHECK ("editors"."role" = ANY (ARRAY['owner'::text, 'editor'::text]))
);
--> statement-breakpoint
ALTER TABLE "editors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hike_revisions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hike_revisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"mdx" text NOT NULL,
	"waypoints" json NOT NULL,
	"status" text NOT NULL,
	"saved_by" uuid,
	"saved_by_label" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hike_revisions_slug_version_key" UNIQUE("slug","version")
);
--> statement-breakpoint
ALTER TABLE "hike_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "hikes" (
	"slug" text PRIMARY KEY NOT NULL,
	"mdx" text NOT NULL,
	"waypoints" json NOT NULL,
	"track" json,
	"details" jsonb NOT NULL,
	"status" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"updated_by_label" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hikes_slug_check" CHECK ("hikes"."slug" ~ '^[a-z0-9-]+$'),
	CONSTRAINT "hikes_status_check" CHECK ("hikes"."status" = ANY (ARRAY['draft'::text, 'published'::text]))
);
--> statement-breakpoint
ALTER TABLE "hikes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "editors" ADD CONSTRAINT "editors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hike_revisions_slug_idx" ON "hike_revisions" USING btree ("slug","version" DESC NULLS FIRST);--> statement-breakpoint
CREATE POLICY "server only" ON "editors" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "server only" ON "hike_revisions" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "server only" ON "hikes" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);