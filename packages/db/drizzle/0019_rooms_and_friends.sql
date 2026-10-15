CREATE TABLE "friendship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_low_id" text NOT NULL,
	"user_high_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "friendship_ordered_pair" CHECK ("friendship"."user_low_id" < "friendship"."user_high_id")
);
--> statement-breakpoint
CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"host_user_id" text,
	"access" text NOT NULL,
	"playback_control" text DEFAULT 'host' NOT NULL,
	"ai_access" text DEFAULT 'host' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"message_seq" bigint DEFAULT 0 NOT NULL,
	"mal_id" integer,
	"provider" text,
	"episode_id" text,
	"episode_number" real,
	"audio" text,
	"selection_revision" bigint DEFAULT 0 NOT NULL,
	"playing" boolean DEFAULT false NOT NULL,
	"position_seconds" double precision DEFAULT 0 NOT NULL,
	"position_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rate" real DEFAULT 1 NOT NULL,
	"host_away_since" timestamp with time zone,
	"last_connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tab_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"runtime_id" text NOT NULL,
	"controller" boolean DEFAULT false NOT NULL,
	"playback_state" text DEFAULT 'idle' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_invite_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"participant_id" uuid,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"request_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"user_id" text,
	"guest_token_hash" text,
	"guest_expires_at" timestamp with time zone,
	"display_name" text,
	"state" text NOT NULL,
	"invited_by" text,
	"share_taste" boolean DEFAULT false NOT NULL,
	"admitted_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_pick" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"mal_id" integer NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_vote" (
	"pick_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_vote_pick_id_participant_id_pk" PRIMARY KEY("pick_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "watch_coverage" (
	"user_id" text NOT NULL,
	"mal_id" integer NOT NULL,
	"episode" integer NOT NULL,
	"intervals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_seconds" integer,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_coverage_user_id_mal_id_episode_pk" PRIMARY KEY("user_id","mal_id","episode")
);
--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_low_id_user_id_fk" FOREIGN KEY ("user_low_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_high_id_user_id_fk" FOREIGN KEY ("user_high_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_connection" ADD CONSTRAINT "room_connection_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_connection" ADD CONSTRAINT "room_connection_participant_id_room_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."room_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_invite_link" ADD CONSTRAINT "room_invite_link_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_invite_link" ADD CONSTRAINT "room_invite_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_message" ADD CONSTRAINT "room_message_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_message" ADD CONSTRAINT "room_message_participant_id_room_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."room_participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participant" ADD CONSTRAINT "room_participant_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participant" ADD CONSTRAINT "room_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participant" ADD CONSTRAINT "room_participant_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_pick" ADD CONSTRAINT "room_pick_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_pick" ADD CONSTRAINT "room_pick_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_pick" ADD CONSTRAINT "room_pick_added_by_room_participant_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."room_participant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_vote" ADD CONSTRAINT "room_vote_pick_id_room_pick_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."room_pick"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_vote" ADD CONSTRAINT "room_vote_participant_id_room_participant_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."room_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_coverage" ADD CONSTRAINT "watch_coverage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_coverage" ADD CONSTRAINT "watch_coverage_mal_id_anime_metadata_mal_id_fk" FOREIGN KEY ("mal_id") REFERENCES "public"."anime_metadata"("mal_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_pair_idx" ON "friendship" USING btree ("user_low_id","user_high_id");--> statement-breakpoint
CREATE INDEX "friendship_high_idx" ON "friendship" USING btree ("user_high_id");--> statement-breakpoint
CREATE INDEX "room_host_idx" ON "room" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "room_public_idx" ON "room" USING btree ("updated_at") WHERE "room"."status" = 'open' and "room"."access" = 'public';--> statement-breakpoint
CREATE INDEX "room_connection_room_idx" ON "room_connection" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "room_connection_participant_idx" ON "room_connection" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_invite_link_token_idx" ON "room_invite_link" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "room_invite_link_room_idx" ON "room_invite_link" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_message_seq_idx" ON "room_message" USING btree ("room_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "room_message_request_idx" ON "room_message" USING btree ("room_id","participant_id","request_id") WHERE "room_message"."request_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "room_participant_user_idx" ON "room_participant" USING btree ("room_id","user_id") WHERE "room_participant"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "room_participant_guest_idx" ON "room_participant" USING btree ("guest_token_hash") WHERE "room_participant"."guest_token_hash" is not null;--> statement-breakpoint
CREATE INDEX "room_participant_user_state_idx" ON "room_participant" USING btree ("user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "room_pick_anime_idx" ON "room_pick" USING btree ("room_id","mal_id");