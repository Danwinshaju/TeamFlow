ALTER TABLE "workspace_messages" ADD COLUMN "recipient_user_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_messages" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_messages" ADD CONSTRAINT "workspace_messages_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_messages_recipient_created_idx" ON "workspace_messages" USING btree ("recipient_user_id","created_at");