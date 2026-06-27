CREATE TABLE "anime_stream_provider_mapping" (
	"mal_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_anime_id" text NOT NULL,
	"matched_title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "anime_stream_provider_mapping_mal_id_provider_pk" PRIMARY KEY("mal_id","provider")
);
--> statement-breakpoint
ALTER TABLE "anime_stream_provider_mapping" ADD CONSTRAINT "anime_stream_provider_mapping_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anime_stream_provider_mapping_provider_idx" ON "anime_stream_provider_mapping" USING btree ("provider","provider_anime_id");