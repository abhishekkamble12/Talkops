import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧭 INTELLIGENT QUERY ROUTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// This step uses LLM to intelligently route customer queries to the appropriate
// autonomous agent:
// - HAVOC: Shipping, delivery, tracking issues
// - HULK: Payment failures, billing, transactions
// - REFUND: Refund requests (routes through fraud detection first)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// User info schema for customer identification
const userInfoSchema = z.object({
  email: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  trackingNumber: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
})

const inputSchema = z.object({
  text: z.string(),
  userInfo: userInfoSchema.optional(),
  requestId: z.string(),
  enableVoiceResponse: z.boolean().optional(),
})

type InputType = z.infer<typeof inputSchema>
type UserInfo = z.infer<typeof userInfoSchema>

// Data passed to agents includes query text, user info, requestId, and voice settings
type AgentData = {
  text: string
  userInfo?: UserInfo
  requestId: string
  enableVoiceResponse?: boolean
}

type EmitData =
  | { topic: 'google.havocRequest'; data: AgentData }
  | { topic: 'google.hulkRequest'; data: AgentData }
  | { topic: 'google.fraud_detectorRequest'; data: AgentData }

export const config: EventConfig = {
  type: 'event',
  name: 'AnalyzeQuery',
  description: 'Intelligent query router using LLM to analyze customer intent and route to the appropriate autonomous agent (Havoc, Hulk, or Fraud Detector for refunds).',
  subscribes: ['google.analyzequeryRequest'],
  emits: ['google.havocRequest', 'google.hulkRequest', 'google.fraud_detectorRequest'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTING SYSTEM PROMPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const systemPrompt = `You are an intelligent query router for an enterprise customer support system. Your job is to analyze customer queries and route them to the correct autonomous agent.

AVAILABLE AGENTS:
1. HAVOC - Handles shipping and delivery issues:
   - Package tracking, delivery status
   - Shipping delays, lost packages
   - Carrier issues, address problems
   - "Where is my order?" type questions

2. HULK - Handles payment and billing issues:
   - Payment failures, declined cards
   - Billing questions, charges
   - Transaction issues
   - Payment method updates
   - NOTE: Does NOT handle refunds

3. REFUND - Handles refund requests (goes through fraud detection):
   - Refund requests
   - Money back requests
   - Order cancellation with refund
   - Return money requests

ROUTING RULES:
- If the query mentions "refund", "money back", "cancel order", "return money" → respond with "refund"
- If the query is about shipping, delivery, tracking, package → respond with "havoc"
- If the query is about payment, billing, charge, transaction (but NOT refund) → respond with "hulk"
- When uncertain between shipping and payment, default to "havoc"

RESPOND WITH EXACTLY ONE WORD: "havoc", "hulk", or "refund"`

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KEYWORD-BASED FALLBACK ROUTING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function routeByKeywords(text: string): 'havoc' | 'hulk' | 'refund' {
  const lowerText = text.toLowerCase()
  
  // Refund-related keywords → fraud_detector (refund flow)
  const refundKeywords = [
    'refund', 'money back', 'cancel order', 'want my money', 
    'return money', 'get refund', 'refunded', 'cancelled',
    'give me back', 'reimburse', 'reimbursement'
  ]
  if (refundKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'refund'
  }
  
  // Payment-related keywords → hulk (but not refund)
  const paymentKeywords = [
    'payment', 'pay', 'charge', 'bill', 'invoice', 'transaction', 
    'failed payment', 'card declined', 'bank', 'billing',
    'double charge', 'overcharge', 'payment method'
  ]
  if (paymentKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'hulk'
  }
  
  // Shipping-related keywords → havoc (default)
  const shippingKeywords = [
    'shipping', 'delivery', 'package', 'parcel', 'order', 'tracking',
    'where is', 'late', 'delayed', 'carrier', 'fedex', 'ups', 'usps',
    'not received', 'lost', 'missing', 'when will', 'status'
  ]
  if (shippingKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'havoc'
  }

  // Default to havoc for general queries
  return 'havoc'
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENT HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger }) => {
  const { text, userInfo, requestId, enableVoiceResponse } = input

  logger.info('[QueryRouter] 🧭 Analyzing query for routing', { 
    text: text.substring(0, 100), 
    userInfo, 
    requestId, 
    enableVoiceResponse 
  })

  let routingResult = ''

  try {
    // Use LLM for intelligent routing
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3, // Low temperature for consistent routing
        maxOutputTokens: 50,
      },
    })

    routingResult = response.text?.trim().toLowerCase() ?? ''
    
    // Validate the response
    if (!['havoc', 'hulk', 'refund'].includes(routingResult)) {
      logger.warn('[QueryRouter] LLM returned invalid routing, falling back', { 
        result: routingResult,
        requestId 
      })
      routingResult = routeByKeywords(text)
    }

    logger.info('[QueryRouter] 🎯 LLM routing decision', { result: routingResult, requestId })

  } catch (error: any) {
    // Fallback to keyword-based routing if AI fails
    logger.warn('[QueryRouter] ⚠️ LLM routing failed, using keyword fallback', { 
      error: error?.message || 'Unknown error',
      requestId
    })
    routingResult = routeByKeywords(text)
    logger.info('[QueryRouter] 🔑 Keyword fallback result', { result: routingResult, requestId })
  }

  // Prepare agent data
  const agentData: AgentData = {
    text,
    userInfo,
    requestId,
    enableVoiceResponse,
  }

  // Route to appropriate agent
  if (routingResult === 'havoc' || routingResult.includes('havoc')) {
    await emit({
      topic: 'google.havocRequest',
      data: agentData,
    })
    logger.info('[QueryRouter] 📦 Routed to Agent Havoc (Shipping)', { requestId })

  } else if (routingResult === 'hulk' || routingResult.includes('hulk')) {
    await emit({
      topic: 'google.hulkRequest',
      data: agentData,
    })
    logger.info('[QueryRouter] 💳 Routed to Agent Hulk (Payments)', { requestId })

  } else if (routingResult === 'refund' || routingResult.includes('refund')) {
    // Refund requests go through fraud detection first
    await emit({
      topic: 'google.fraud_detectorRequest',
      data: agentData,
    })
    logger.info('[QueryRouter] 🔍 Routed to Fraud Detector (Refund Request)', { requestId })

  } else {
    // Default to havoc for unknown queries
    logger.warn('[QueryRouter] ❓ Unknown routing result, defaulting to havoc', { 
      result: routingResult,
      requestId 
    })
    await emit({
      topic: 'google.havocRequest',
      data: agentData,
    })
  }

  logger.info('[QueryRouter] ✅ Query routed successfully', { 
    agent: routingResult, 
    requestId 
  })
}
