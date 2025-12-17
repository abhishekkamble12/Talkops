import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
  response: z.string(),
  requestId: z.string(),
  customerData: z.object({
    customerId: z.string(),
    name: z.string(),
    ordersCount: z.number(),
  }).optional(),
})

type InputType = z.infer<typeof inputSchema>

type EmitData = {
  topic: 'voice.synthesize'
  data: { text: string; requestId: string }
}

export const config: EventConfig = {
  type: 'event',
  name: 'HavocResponseHandler',
  description: 'Handles responses from Agent Havoc (shipping issues) and triggers voice synthesis if enabled',
  subscribes: ['havoc.response'],
  emits: ['voice.synthesize'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

export const handler: EventHandler<InputType, EmitData> = async (input, { logger, state, emit }) => {
  const { response, requestId, customerData } = input

  logger.info('[HavocResponse] ✅ Received shipping support response', {
    requestId,
    responseLength: response.length,
    hasCustomerData: !!customerData,
  })

  if (customerData) {
    logger.info('[HavocResponse] Customer', {
      customerId: customerData.customerId,
      name: customerData.name,
      ordersCount: customerData.ordersCount,
    })
  }

  logger.info('[HavocResponse] AI Response:', { requestId, message: response })

  // Check if voice response is enabled for this request
  try {
    const responseState = await state.get<any>('responses', requestId)
    if (responseState?.enableVoiceResponse) {
      logger.info('[HavocResponse] Voice response enabled, triggering TTS', { requestId })
      await emit({
        topic: 'voice.synthesize',
        data: { text: response, requestId },
      })
    }
  } catch (error: any) {
    logger.warn('[HavocResponse] Could not check voice response state', { 
      error: error?.message, 
      requestId 
    })
  }
}

