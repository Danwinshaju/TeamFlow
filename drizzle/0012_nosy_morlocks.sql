CREATE TABLE "user_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'awaiting_payment' NOT NULL,
	"stripe_customer_id" varchar(100),
	"stripe_subscription_id" varchar(100),
	"stripe_price_id" varchar(100),
	"workspace_id" uuid,
	"approved_role" "workspace_role",
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_access_requests" ADD CONSTRAINT "user_access_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_requests" ADD CONSTRAINT "user_access_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_access_requests" ADD CONSTRAINT "user_access_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_requests_user_unique" ON "user_access_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_access_requests_subscription_unique" ON "user_access_requests" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "user_access_requests_status_idx" ON "user_access_requests" USING btree ("status");