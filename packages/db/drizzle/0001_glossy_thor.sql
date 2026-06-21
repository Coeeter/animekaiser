CREATE TABLE "job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_conflict" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"provider" text NOT NULL,
	"local_value" jsonb NOT NULL,
	"external_value" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"banner_key" text,
	"description" text,
	"private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_library_entry" (
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"status" text NOT NULL,
	"score" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"anilist_entry_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_library_entry_user_id_mal_id_pk" PRIMARY KEY("user_id","mal_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_login_method" text;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_conflict" ADD CONSTRAINT "library_conflict_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_entry" ADD CONSTRAINT "user_library_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_claim_idx" ON "job" USING btree ("type","status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "library_conflict_entry_provider_idx" ON "library_conflict" USING btree ("user_id","mal_id","provider");--> statement-breakpoint
CREATE INDEX "library_conflict_user_status_idx" ON "library_conflict" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_library_entry_user_status_idx" ON "user_library_entry" USING btree ("user_id","status");