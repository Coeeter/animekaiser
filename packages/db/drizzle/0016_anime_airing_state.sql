CREATE TABLE "anime_airing_state" (
	"mal_id" integer PRIMARY KEY NOT NULL,
	"airing_status" text,
	"total_episodes" integer,
	"latest_aired_episode" integer,
	"latest_aired_at" timestamp,
	"latest_aired_source" text,
	"next_episode" integer,
	"next_airing_at" timestamp,
	"available_episode" integer,
	"available_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anime_airing_state" ADD CONSTRAINT "anime_airing_state_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;