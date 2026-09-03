CREATE TYPE "public"."project_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"key" varchar(20) NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_key_unique" ON "projects" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");