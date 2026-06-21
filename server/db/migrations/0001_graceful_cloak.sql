CREATE TABLE "abuse_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text,
	"reporter_email" text,
	"category" text NOT NULL,
	"target" text NOT NULL,
	"details" text,
	"ip" text,
	"user_agent" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;