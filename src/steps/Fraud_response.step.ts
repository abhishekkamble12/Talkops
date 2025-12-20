import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
  response: z.string(),
  requestId: z.string(),
  fraudDetected: z.boolean(),
  reason: z.string().optional(),
  customerData: z.object({
    customerId: z.string(),
    name: z.string(),
  }).optional(),
})

type InputType = z.infer<typeof inputSchema>

type EmitData = {
  topic: 'voice.synthesize'
  data: { text: string; requestId: string }
}

export const config: EventConfig = {
  type: 'event',
  name: 'FraudResponseHandler',
  description: 'Handles fraud detection results and triggers voice synthesis if enabled',
  subscribes: ['fraud.detection.response'],
  emits: ['voice.synthesize'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

export const handler: EventHandler<InputType, EmitData> = async (input, { logger, state, emit }) => {
  const { response, requestId, fraudDetected, reason, customerData } = input

  logger.info('[FraudResponse] Received fraud detection result', {
    requestId,
    fraudDetected,
    reason,
    hasCustomerData: !!customerData,
  })

  if (fraudDetected) {
    logger.warn('[FraudResponse] 🚫 Fraud detected, refund blocked', {
      requestId,
      reason,
      customerId: customerData?.customerId,
    })
  } else {
    logger.info('[FraudResponse] ✅ No fraud detected, refund proceeding', {
      requestId,
      customerId: customerData?.customerId,
    })
  }

  logger.info('[FraudResponse] Response:', { requestId, message: response.substring(0, 200) })

  // Check if voice response is enabled
  try {
    const responseState = await state.get<any>('responses', requestId)
    if (responseState?.enableVoiceResponse && fraudDetected && process.env.GROQ_API_KEY) {
      // Only trigger voice for blocked refunds (fraud detected)
      // Approved refunds will get voice from the refund response handler
      logger.info('[FraudResponse] Voice response enabled, triggering TTS for blocked refund', { requestId })
      await emit({
        topic: 'voice.synthesize',
        data: { text: response, requestId },
      })
    } else {
      logger.info('[FraudResponse] Voice response disabled, fraud not detected, or GROQ_API_KEY missing', {
        requestId,
        enableVoiceResponse: responseState?.enableVoiceResponse,
        fraudDetected,
        hasGroqKey: !!process.env.GROQ_API_KEY
      })
    }
  } catch (error: any) {
    logger.warn('[FraudResponse] Could not check voice response state', {
      error: error?.message,
      requestId
    })
  }
}

