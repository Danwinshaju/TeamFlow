import Razorpay from "razorpay";

import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  const amount = Number(body?.amount ?? process.env.NEXT_PUBLIC_RAZORPAY_AMOUNT_PAISE ?? 0);
  if (!Number.isInteger(amount) || amount < 100) {
    return Response.json({ error: "Amount must be at least 100 paise." }, { status: 400 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return Response.json({ error: "Razorpay is not configured." }, { status: 503 });
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `teamflow_${user.id}_${Date.now()}`.slice(0, 40),
    });

    return Response.json({ order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error("Failed to create Razorpay order", error);
    return Response.json({ error: "Could not create the payment order." }, { status: 500 });
  }
}