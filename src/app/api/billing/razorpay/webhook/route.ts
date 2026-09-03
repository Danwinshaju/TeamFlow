import { eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceSubscriptions } from "@/db/schema";
import { verifyRazorpayWebhookSignature } from "@/lib/billing/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return Response.json({ error: "Missing signature." }, { status: 400 });

  try {
    if (!verifyRazorpayWebhookSignature(payload, signature)) {
      return Response.json({ error: "Invalid signature." }, { status: 400 });
    }

    const event = JSON.parse(payload) as {
      event?: string;
      payload?: { subscription?: { entity?: { id?: string; status?: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired"; current_start?: number; current_end?: number } } };
    };
    const entity = event.payload?.subscription?.entity;
    if (!entity?.id || !entity.status) return Response.json({ received: true });

    await db.update(workspaceSubscriptions).set({
      status: entity.status,
      currentPeriodStart: entity.current_start ? new Date(entity.current_start * 1000) : undefined,
      currentPeriodEnd: entity.current_end ? new Date(entity.current_end * 1000) : undefined,
      updatedAt: new Date(),
    }).where(eq(workspaceSubscriptions.razorpaySubscriptionId, entity.id));

    return Response.json({ received: true });
  } catch (error) {
    console.error("Failed to process Razorpay webhook", error);
    return Response.json({ error: "Invalid webhook." }, { status: 400 });
  }
}