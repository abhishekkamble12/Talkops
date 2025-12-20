/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🎙 AGENT AISHA - AI Voice Customer Care Agent
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * RESPONSIBILITIES:
 * - Act as the COMMUNICATION LAYER for users
 * - Listen to havoc.response and hulk.response events
 * - Transform internal agent responses to voice-friendly format
 * - NEVER decide logic - only communicates what agents decided
 */

import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { transformForVoice } from '../lib/gemini'

// Use the same schema as the other handlers for compatibility
const agentResponseSchema = z.object({
  response: z.string(),
  agentState: z.any().optional(),
  requestId: z.string(),
  enableVoiceResponse: z.boolean().optional(),
  sourceAgent: z.enum(['havoc', 'hulk', 'fraud_detector', 'refund']),
  customerData: z.object({
    customerId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    ordersCount: z.number().optional(),
  }).optional(),
  refundApproved: z.boolean().optional(),
  refundId: z.string().optional(),
  refundAmount: z.number().optional(),
})

type AgentResponseInput = z.infer<typeof agentResponseSchema>

type EmitData = {
  topic: 'voice.synthesize'
  data: {
    text: string
    requestId: string
  }
}

export const config: EventConfig = {
  type: 'event',
  name: 'Agent_Aisha',
  description: 'AISHA - AI Voice Customer Care Agent. Transforms internal agent responses into empathetic, voice-friendly communications.',
  subscribes: ['havoc.response', 'hulk.response', 'refund.response', 'fraud.response'],
  emits: ['voice.synthesize'],
  input: agentResponseSchema as any,
  flows: ['customer-support'],
}

const AISHA_SYSTEM_PROMPT = `You are Aisha, an AI-powered customer care voice agent. Transform technical responses into warm, empathetic, human-like communications.

VOICE-FRIENDLY GUIDELINES:
- Use natural, conversational language
- Avoid technical jargon
- Use contractions (I'm, we're, you'll)
- Keep sentences short and clear
- Personalize with customer name when available
- Vary your opening phrases

CRITICAL RULES:
- NEVER promise things not confirmed by the agent
- NEVER make up order numbers, dates, or amounts
- Keep responses under 150 words for voice clarity`

function transformWithFallback(response: string, customerName: string | null): string {
  const openings = [
    customerName ? `Hi ${customerName}, ` : 'Hi there! ',
    'Thanks for reaching out. ',
    "I've looked into this for you. ",
    'Thanks for your patience. ',
  ]
  const closings = [
    ' Is there anything else I can help you with?',
    " I'm here if you have any other questions.",
    ' Let me know if you need anything else.',
  ]
  const opening = openings[Math.floor(Math.random() * openings.length)]
  const closing = closings[Math.floor(Math.random() * closings.length)]
  const cleaned = response.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '').trim()
  return `${opening}${cleaned}${closing}`
}

export const handler: EventHandler<AgentResponseInput, EmitData> = async (input, { emit, logger, state }) => {
  const { response, agentState, requestId, enableVoiceResponse, sourceAgent, customerData } = input

  logger.info('[Agent Aisha] 🎙 Received agent response to transform', {
    requestId,
    sourceAgent,
    responseLength: response.length,
  })

  try {
    const customerName = customerData?.name || null
    let aishaResponse: string

    // Try LLM transformation
    const transformContext = {
      customerName: customerName || 'Not provided',
      sourceAgent,
      agentStateSummary: agentState,
    }

    const llmResult = await transformForVoice(AISHA_SYSTEM_PROMPT, response, transformContext)

    if (llmResult.success) {
      aishaResponse = llmResult.text
      logger.info('[Agent Aisha] 🧠 Response transformed', { requestId })
    } else {
      logger.warn('[Agent Aisha] Using fallback transformation', { error: llmResult.error })
      aishaResponse = transformWithFallback(response, customerName)
    }

    // Update state
    const existingState = await state.get<any>('responses', requestId) || {}
    await state.set('responses', requestId, {
      ...existingState,
      response: aishaResponse,
      originalAgentResponse: response,
      communicatedBy: 'aisha',
      transformedAt: new Date().toISOString(),
    })

    // Trigger voice synthesis if enabled
    if (enableVoiceResponse !== false) {
      await emit({
        topic: 'voice.synthesize',
        data: { text: aishaResponse, requestId },
      })
      logger.info('[Agent Aisha] 🔊 Voice synthesis triggered', { requestId })
    }

    logger.info('[Agent Aisha] ✅ Response communicated', { requestId, sourceAgent })
  } catch (error: any) {
    logger.error('[Agent Aisha] 💥 Error', { error: error?.message, requestId })

    const fallbackResponse = `I appreciate your patience. ${response}`
    const existingState = await state.get<any>('responses', requestId) || {}
    await state.set('responses', requestId, {
      ...existingState,
      response: fallbackResponse,
      communicatedBy: 'aisha-fallback',
    })

    if (enableVoiceResponse !== false) {
      await emit({
        topic: 'voice.synthesize',
        data: { text: fallbackResponse, requestId },
      })
    }
  }
}

