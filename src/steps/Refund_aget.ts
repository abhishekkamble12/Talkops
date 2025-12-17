import { EventHandlerConfig } from "motia";
import { z } from "zod";
import { randomUUID } from "crypto";

// ---------------- CONFIG ----------------
export const config: EventHandlerConfig = {
  name: "Refund Processing Agent",
  type: "event",

  // 🔹 Starts when refund is requested
  subscribes: ["google.refund.requested"],

  // 🔹 Possible outcomes
  emits: [
    "google.refund.success",
    "google.refund.failed",
    "google.refund.requested",
  ],
};

// ---------------- SCHEMA ----------------
const refundSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  reason: z.string(),
  paymentId: z.string(),
});

// ---------------- HANDLER ----------------
export default async function handler(
  event: unknown,
  { emit, logger, state }: any
) {
  const REFUND_ID = randomUUID();

  try {
    // 1️⃣ Validate input
    const refund = refundSchema.parse(event);

    logger.info("Refund initiated", {
      REFUND_ID,
      orderId: refund.orderId,
    });

    // 2️⃣ Save refund state
    await state.set("refund", REFUND_ID, {
      ...refund,
      status: "PROCESSING",
      createdAt: new Date().toISOString(),
    });

    // 3️⃣ Simulate payment gateway refund
    // (Replace with Stripe / Razorpay / PayPal API later)
    await new Promise((r) => setTimeout(r, 1500));

    const refundReference = "rf_" + Date.now();

    // 4️⃣ Update state
    await state.set("refund", REFUND_ID, {
      ...refund,
      refundReference,
      status: "SUCCESS",
      completedAt: new Date().toISOString(),
    });

    // 5️⃣ Emit success
    await emit("google.refund.success", {
      refundId: REFUND_ID,
      refundReference,
      orderId: refund.orderId,
      amount: refund.amount,
    });

    logger.info("Refund successful", {
      REFUND_ID,
      refundReference,
    });

  } catch (error: any) {
    logger.error("Refund failed", error);

    // Emit failure
    await emit("google.refund.failed", {
      refundId: REFUND_ID,
      error: error.message,
    });
  }
}
