ALTER TABLE "workspace_messages" ADD COLUMN "attachment_type" varchar(20);--> statement-breakpoint
ALTER TABLE "workspace_messages" ADD COLUMN "attachment_name" varchar(255);--> statement-breakpoint
ALTER TABLE "workspace_messages" ADD COLUMN "attachment_mime_type" varchar(120);--> statement-breakpoint
ALTER TABLE "workspace_messages" ADD COLUMN "attachment_data_url" text;