import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

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
  description: 'Calls Google AI to analyze query and route to the appropriate agent. Refund requests go through fraud detection first.',
  subscribes: ['google.analyzequeryRequest'],
  emits: ['google.havocRequest', 'google.hulkRequest', 'google.fraud_detectorRequest'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

const systemPrompt = `You are a helpful assistant that helps to solve user queries. You have multiple agents and you must respond with ONLY ONE WORD to indicate which agent should handle the query.

Agent 1: havoc - handles shipping delays, tracking issues, delivery problems, package location
Agent 2: hulk - handles payment failures, billing issues, transaction problems (NOT refunds)
Agent 3: refund - handles refund requests, money back requests, cancellation with refund

IMPORTANT: If the user is asking for a REFUND or wants their MONEY BACK, respond with "refund"

Respond with only one word: "havoc", "hulk", or "refund" based on the user's query.`

// Keyword-based fallback routing when AI is unavailable
function routeByKeywords(text: string): 'havoc' | 'hulk' | 'refund' {
  const lowerText = text.toLowerCase()
  
  // Refund-related keywords → fraud_detector (refund flow)
  const refundKeywords = ['refund', 'money back', 'cancel order', 'want my money', 'return money', 'get refund', 'refunded', 'cancelled']
  if (refundKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'refund'
  }
  
  // Payment-related keywords → hulk (but not refund)
  const paymentKeywords = ['payment', 'pay', 'charge', 'bill', 'invoice', 'transaction', 'failed payment', 'card declined', 'bank']
  if (paymentKeywords.some(keyword => lowerText.includes(keyword))) {
    return 'hulk'
  }
  
  // Shipping-related keywords → havoc (default)
  return 'havoc'
}

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger }) => {
  const { text, userInfo, requestId, enableVoiceResponse } = input

  logger.info('[AnalyzeQuery] Received query', { text, userInfo, requestId, enableVoiceResponse })

  let result = ''

  try {
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
        temperature: 0.3,
        maxOutputTokens: 100,
      },
    })

    result = response.text?.trim().toLowerCase() ?? ''
    logger.info('[AnalyzeQuery] AI Response', { result })
  } catch (error: any) {
    // Fallback to keyword-based routing if AI fails (quota exceeded, etc.)
    logger.warn('[AnalyzeQuery] AI call failed, using keyword fallback', { 
      error: error?.message || 'Unknown error' 
    })
    result = routeByKeywords(text)
    logger.info('[AnalyzeQuery] Keyword fallback result', { result })
  }

  // Pass text, userInfo, requestId, and voice settings to the selected agent
  const agentData: AgentData = {
    text,
    userInfo,
    requestId,
    enableVoiceResponse,
  }

  if (result === 'havoc' || result.includes('havoc')) {
    await emit({
      topic: 'google.havocRequest',
      data: agentData,
    })
    logger.info('[AnalyzeQuery] Routed to Agent Havoc (Shipping)', { requestId })
  } else if (result === 'hulk' || result.includes('hulk')) {
    await emit({
      topic: 'google.hulkRequest',
      data: agentData,
    })
    logger.info('[AnalyzeQuery] Routed to Agent Hulk (Payments)', { requestId })
  } else if (result === 'refund' || result.includes('refund')) {
    // Refund requests go through fraud detection first
    await emit({
      topic: 'google.fraud_detectorRequest',
      data: agentData,
    })
    logger.info('[AnalyzeQuery] Routed to Fraud Detector (Refund Request)', { requestId })
  } else {
    // Default to havoc for unknown queries
    logger.warn('[AnalyzeQuery] Unknown response, defaulting to havoc', { result })
    await emit({
      topic: 'google.havocRequest',
      data: agentData,
    })
  }

  logger.info('[AnalyzeQuery] Query routed successfully', { agent: result, requestId })
}