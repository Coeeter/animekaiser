ALTER TABLE "profile" ADD COLUMN "onboarded" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "onboarded" SET DEFAULT false;