ALTER TABLE "anime_metadata" ADD COLUMN "genres" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "anime_metadata" ADD COLUMN "season_year" integer;