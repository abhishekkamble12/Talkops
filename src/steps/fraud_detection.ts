import { EventHandlerConfig } from "motia";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

export const config: EventHandlerConfig = {
  name: "Fraud Detection Agent",
  type: "event",

  // 🔹 This agent starts here
  subscribes: ["google.fraud_detectorRequest"],

  // 🔹 Possible next steps
  emits: [
    "google.paymentagent",
    "google.payment.blocked",
    "google.payment.challenge",
    "google.refund.requested",
  ],
};

// ---------------- AI SCHEMA ----------------
const riskSchema = {
  description: "Fraud risk assessment",
  type: SchemaType.OBJECT,
  properties: {
    riskScore: { type: SchemaType.NUMBER },
    decision: {
      type: SchemaType.STRING,
      enum: ["APPROVE", "CHALLENGE", "BLOCK"],
    },
    flaggedFactors: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    explanation: { type: SchemaType.STRING },
  },
  required: ["riskScore", "decision", "explanation"],
};

// ---------------- HANDLER ----------------
export default async function handler(
  event: {
    transaction: any;
    userHistory: any;
  },
  { emit, logger }: any
) {
  logger.info("Fraud check started", event);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: riskSchema,
    },
  });

  const { transaction, userHistory } = event;

  const prompt = `
Analyze this transaction for fraud.

TRANSACTION:
- Amount: $${transaction.amount}
- Item: ${transaction.item}
- IP Country: ${transaction.ipCountry}
- Shipping Address: ${transaction.shippingAddr}

USER HISTORY:
- Account Age: ${userHistory.accountAgeDays} days
- Previous Chargebacks: ${userHistory.chargebacks}
- Average Order Value: $${userHistory.avgOrderValue}

RULES:
- High velocity is suspicious
- IP & shipping mismatch is suspicious
- Orders > 5x avg value are suspicious

Return a JSON fraud assessment.
`;

  const result = await model.generateContent(prompt);
  const risk = JSON.parse(result.response.text());

  logger.info("Fraud decision", risk);

  // ---------------- DECISION FLOW ----------------
  if (risk.decision === "APPROVE") {
    await emit("google.paymentagent", {
      transaction,
      risk,
    });
  }

  if (risk.decision === "CHALLENGE") {
    await emit("google.payment.challenge", {
      transaction,
      risk,
    });
  }

  if (risk.decision === "BLOCK") {
    await emit("google.payment.blocked", {
      transaction,
      risk,
    });
  }
}
