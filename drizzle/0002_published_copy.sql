ALTER TABLE "hikes" ADD COLUMN "published_mdx" text;--> statement-breakpoint
ALTER TABLE "hikes" ADD COLUMN "published_waypoints" json;--> statement-breakpoint
ALTER TABLE "hikes" ADD COLUMN "published_details" jsonb;--> statement-breakpoint
ALTER TABLE "hikes" ADD COLUMN "published_version" integer;--> statement-breakpoint
ALTER TABLE "hikes" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- The `draft` frontmatter flag is retired: a guide is public exactly when it has a published copy.
UPDATE "hikes" SET "mdx" = regexp_replace("mdx", '^draft: *(true|false) *\n', '', 'n'), "details" = "details" - 'draft';--> statement-breakpoint
-- What's public today becomes the published copy.
UPDATE "hikes" SET "published_mdx" = "mdx", "published_waypoints" = "waypoints", "published_details" = "details", "published_version" = "version", "published_at" = "updated_at" WHERE "status" = 'published';
