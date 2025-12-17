import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
  response: z.string(),
  requestId: z.string(),
  refundApproved: z.boolean(),
  refundAmount: z.number().optional(),
  refundId: z.string().optional(),
  customerData: z.any().optional(),
})

type InputType = z.infer<typeof inputSchema>

type EmitData = {
  topic: 'voice.synthesize'
  data: { text: string; requestId: string }
}

export const config: EventConfig = {
  type: 'event',
  name: 'RefundResponseHandler',
  description: 'Handles refund processing results and triggers voice synthesis if enabled',
  subscribes: ['refund.response'],
  emits: ['voice.synthesize'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

export const handler: EventHandler<InputType, EmitData> = async (input, { logger, state, emit }) => {
  const { response, requestId, refundApproved, refundAmount, refundId, customerData } = input

  logger.info('[RefundResponse] Received refund processing result', {
    requestId,
    refundApproved,
    refundId,
    refundAmount,
    hasCustomerData: !!customerData,
  })

  if (refundApproved) {
    logger.info('[RefundResponse] ✅ Refund approved and processed', {
      requestId,
      refundId,
      refundAmount,
      customerId: customerData?.customerId,
    })
  } else {
    logger.warn('[RefundResponse] ❌ Refund not approved', {
      requestId,
      customerId: customerData?.customerId,
    })
  }

  logger.info('[RefundResponse] Response:', { 
    requestId, 
    refundId,
    message: response.substring(0, 200) 
  })

  // Check if voice response is enabled
  try {
    const responseState = await state.get<any>('responses', requestId)
    if (responseState?.enableVoiceResponse) {
      logger.info('[RefundResponse] Voice response enabled, triggering TTS', { requestId })
      await emit({
        topic: 'voice.synthesize',
        data: { text: response, requestId },
      })
    }
  } catch (error: any) {
    logger.warn('[RefundResponse] Could not check voice response state', { 
      error: error?.message, 
      requestId 
    })
  }
}

