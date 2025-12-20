/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📡 QUERY API ENDPOINT - Customer Support Entry Point
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * This is the main API endpoint for customer support queries.
 * It accepts text queries (and optionally voice input), validates them,
 * and routes them through the intelligent query router to the appropriate agent.
 * 
 * ENDPOINT: POST /api/support/query
 */

import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCHEMAS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const userInfoSchema = z.object({
  email: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  trackingNumber: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
})

const bodySchema = z.object({
  text: z.string().min(1, 'Query text is required'),
  userInfo: userInfoSchema.optional(),
  enableVoiceResponse: z.boolean().optional(),
})

type BodyType = z.infer<typeof bodySchema>
type UserInfo = z.infer<typeof userInfoSchema>

type EmitData = {
  topic: 'google.analyzequeryRequest'
  data: {
    text: string
    userInfo?: UserInfo
    requestId: string
    enableVoiceResponse: boolean
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'SupportQuery',
  description: 'Customer support query endpoint. Accepts text queries and routes to appropriate autonomous agent.',
  path: '/api/support/query',
  method: 'POST',
  emits: ['google.analyzequeryRequest'],
  bodySchema: bodySchema as any,
  flows: ['customer-support'],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const handler: ApiRouteHandler<BodyType, ApiResponse, EmitData> = async (req, { emit, logger, state }) => {
  const requestId = randomUUID()

  try {
    const { text, userInfo, enableVoiceResponse = false } = req.body

    logger.info('[SupportQuery] 📥 Received query', {
      requestId,
      textLength: text.length,
      hasUserInfo: !!userInfo,
      enableVoiceResponse,
    })

    // Initialize request state
    await state.set('responses', requestId, {
      status: 'processing',
      requestId,
      query: text,
      userInfo,
      enableVoiceResponse,
      createdAt: new Date().toISOString(),
    })

    // Route to intelligent query router
    await emit({
      topic: 'google.analyzequeryRequest',
      data: {
        text,
        userInfo,
        requestId,
        enableVoiceResponse,
      },
    })

    logger.info('[SupportQuery] ✅ Query submitted for processing', { requestId })

    return {
      status: 202,
      body: {
        success: true,
        message: 'Query accepted for processing',
        requestId,
        status: 'processing',
      },
    }

  } catch (error: any) {
    logger.error('[SupportQuery] ❌ Error processing query', {
      requestId,
      error: error?.message,
    })

    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to process query',
        message: error?.message,
        requestId,
      },
    }
  }
}

