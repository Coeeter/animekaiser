CREATE TABLE "ai_budget_month" (
	"month" text PRIMARY KEY NOT NULL,
	"reserved_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"spent_usd" numeric(10, 6) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"actor_key" text NOT NULL,
	"room_id" uuid,
	"thread_id" uuid,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"model" text NOT NULL,
	"reserved_usd" numeric(10, 6) NOT NULL,
	"actual_usd" numeric(10, 6),
	"usage" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ai_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_daily" (
	"key" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_daily_key_day_pk" PRIMARY KEY("key","day")
);
--> statement-breakpoint
CREATE TABLE "recommendation_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"content" text NOT NULL,
	"data" jsonb,
	"request_id" text,
	"generation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_thread" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text,
	"guest_participant_id" uuid,
	"room_id" uuid,
	"title" text NOT NULL,
	"context" jsonb,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generation" ADD CONSTRAINT "ai_generation_thread_id_recommendation_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."recommendation_thread"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_preference" ADD CONSTRAINT "ai_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_message" ADD CONSTRAINT "recommendation_message_thread_id_recommendation_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."recommendation_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_thread" ADD CONSTRAINT "recommendation_thread_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_thread" ADD CONSTRAINT "recommendation_thread_guest_participant_id_room_participant_id_fk" FOREIGN KEY ("guest_participant_id") REFERENCES "public"."room_participant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_thread" ADD CONSTRAINT "recommendation_thread_room_id_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generation_request_idx" ON "ai_generation" USING btree ("actor_key","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generation_thread_running_idx" ON "ai_generation" USING btree ("thread_id") WHERE "ai_generation"."status" = 'running' and "ai_generation"."thread_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generation_room_running_idx" ON "ai_generation" USING btree ("room_id") WHERE "ai_generation"."status" = 'running' and "ai_generation"."thread_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_message_seq_idx" ON "recommendation_message" USING btree ("thread_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_message_request_idx" ON "recommendation_message" USING btree ("thread_id","request_id") WHERE "recommendation_message"."request_id" is not null;--> statement-breakpoint
CREATE INDEX "recommendation_thread_owner_idx" ON "recommendation_thread" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "recommendation_thread_guest_idx" ON "recommendation_thread" USING btree ("guest_participant_id");