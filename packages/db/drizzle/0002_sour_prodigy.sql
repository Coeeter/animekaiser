CREATE TABLE "anime_metadata" (
	"mal_id" integer PRIMARY KEY NOT NULL,
	"anilist_id" integer,
	"title_romaji" text NOT NULL,
	"title_english" text,
	"cover_image" text,
	"episodes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_sync_event" (
	"id" text PRIMARY KEY NOT NULL,
	"source_event_id" text,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"provider" text NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_conflict" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "library_conflict" CASCADE;--> statement-breakpoint
ALTER TABLE "external_list_account" ADD COLUMN "relink_required_at" timestamp;--> statement-breakpoint
ALTER TABLE "library_sync_event" ADD CONSTRAINT "library_sync_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_sync_event" ADD CONSTRAINT "library_sync_event_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anime_metadata_anilist_id_idx" ON "anime_metadata" USING btree ("anilist_id");--> statement-breakpoint
CREATE INDEX "library_sync_event_claim_idx" ON "library_sync_event" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "library_sync_event_user_idx" ON "library_sync_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "library_sync_event_pending_idx" ON "library_sync_event" USING btree ("user_id","mal_id","provider") WHERE "library_sync_event"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "user_library_entry" ADD CONSTRAINT "user_library_entry_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;