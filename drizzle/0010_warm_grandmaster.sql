ALTER TABLE "workspace_subscriptions" RENAME COLUMN "razorpay_plan_id" TO "stripe_price_id";--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" RENAME COLUMN "razorpay_subscription_id" TO "stripe_subscription_id";--> statement-breakpoint
DROP INDEX "workspace_subscriptions_razorpay_id_unique";--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ADD COLUMN "stripe_customer_id" varchar(100) DEFAULT 'legacy_razorpay' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_subscriptions" ALTER COLUMN "stripe_customer_id" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_subscriptions_stripe_id_unique" ON "workspace_subscriptions" USING btree ("stripe_subscription_id");
