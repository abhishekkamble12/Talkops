import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
  response: z.string(),
  requestId: z.string(),
  customerData: z.object({
    customerId: z.string(),
    name: z.string(),
    email: z.string(),
  }).optional(),
})

type InputType = z.infer<typeof inputSchema>

type EmitData = {
  topic: 'voice.synthesize'
  data: { text: string; requestId: string }
}

export const config: EventConfig = {
  type: 'event',
  name: 'HulkResponseHandler',
  description: 'Handles responses from Agent Hulk (payment issues) and triggers voice synthesis if enabled',
  subscribes: ['hulk.response'],
  emits: ['voice.synthesize'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

export const handler: EventHandler<InputType, EmitData> = async (input, { logger, state, emit }) => {
  const { response, requestId, customerData } = input

  logger.info('[HulkResponse] ✅ Received payment support response', {
    requestId,
    responseLength: response.length,
    hasCustomerData: !!customerData,
  })

  if (customerData) {
    logger.info('[HulkResponse] Customer', {
      customerId: customerData.customerId,
      name: customerData.name,
      email: customerData.email,
    })
  }

  logger.info('[HulkResponse] AI Response:', { requestId, message: response })

  // Check if voice response is enabled for this request
  try {
    const responseState = await state.get<any>('responses', requestId)
    if (responseState?.enableVoiceResponse) {
      logger.info('[HulkResponse] Voice response enabled, triggering TTS', { requestId })
      await emit({
        topic: 'voice.synthesize',
        data: { text: response, requestId },
      })
    }
  } catch (error: any) {
    logger.warn('[HulkResponse] Could not check voice response state', { 
      error: error?.message, 
      requestId 
    })
  }
}

