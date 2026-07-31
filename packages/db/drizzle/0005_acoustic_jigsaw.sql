ALTER TABLE "watch_history" ADD COLUMN "provider" text NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_history" ADD COLUMN "episode_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_history" ADD COLUMN "position_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "watch_history" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "watch_history_user_episode_idx" ON "watch_history" USING btree ("user_id","mal_id","episode");--> statement-breakpoint
CREATE INDEX "watch_history_user_updated_idx" ON "watch_history" USING btree ("user_id","updated_at");