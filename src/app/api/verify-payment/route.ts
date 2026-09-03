import { createHmac, timingSafeEqual } from "node:crypto";

import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    razorpay_payment_id?: unknown;
    razorpay_order_id?: unknown;
    razorpay_signature?: unknown;
  } | null;
  const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const orderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!paymentId || !orderId || !signature) {
    return Response.json({ error: "Payment verification fields are required." }, { status: 400 });
  }
  if (!keySecret) return Response.json({ error: "Razorpay is not configured." }, { status: 503 });

  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  const valid = expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);

  if (!valid) return Response.json({ success: false, error: "Signature verification failed." }, { status: 400 });
  return Response.json({ success: true });
}