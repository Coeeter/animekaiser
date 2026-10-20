ALTER TABLE "ai_generation" ADD COLUMN "progress_text" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_generation" ADD COLUMN "progress_activity" text;
