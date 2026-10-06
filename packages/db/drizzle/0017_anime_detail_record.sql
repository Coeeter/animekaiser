CREATE TABLE "anime_detail_record" (
	"mal_id" integer PRIMARY KEY NOT NULL,
	"detail" jsonb NOT NULL,
	"fresh_until" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
