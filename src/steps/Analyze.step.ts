import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// User info schema for customer identification
const userInfoSchema = z.object({
  email: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  trackingNumber: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
})

const bodySchema = z.object({
  text: z.string().min(1, 'text is required'),
  userInfo: userInfoSchema.optional(),
})

type BodyType = z.infer<typeof bodySchema>
type UserInfo = z.infer<typeof userInfoSchema>

type EmitData = {
  topic: 'google.analyzequeryRequest'
  data: { text: string; userInfo?: UserInfo; requestId: string }
}

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'analyzeUserquery',
  description: 'Receives user query with optional user info and routes to appropriate agent.',
  path: '/api/order/query',
  method: 'POST',
  emits: ['google.analyzequeryRequest'],
  bodySchema: bodySchema as any,
  flows: ['customer-support'],
}

export const handler: ApiRouteHandler<BodyType, ApiResponse, EmitData> = async (req, { emit, logger, state }) => {
  const { text, userInfo } = req.body

  // Generate unique request ID for tracking the response
  const requestId = randomUUID()

  logger.info('[Userquery] Received query', { text, userInfo, requestId })

  // Initialize state for this request
  await state.set('responses', requestId, {
    status: 'processing',
    requestId,
    query: text,
    createdAt: new Date().toISOString(),
  })

  // Emit event with requestId for tracking
  await emit({
    topic: 'google.analyzequeryRequest',
    data: { text, userInfo, requestId },
  })

  // Return the requestId so frontend can poll for response
  return {
    status: 200,
    body: { 
      status: 'Accepted', 
      message: 'Your query is being processed',
      requestId,
    },
  }
}