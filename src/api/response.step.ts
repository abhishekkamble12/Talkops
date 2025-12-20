/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📤 RESPONSE API ENDPOINT - Fetch Agent Response
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * This endpoint allows polling for the response to a submitted query.
 * Use the requestId from the query submission to fetch the result.
 * 
 * ENDPOINT: GET /api/support/response/:requestId
 */

import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetResponse',
  description: 'Fetch the response for a submitted query using the requestId.',
  path: '/api/support/response/:requestId',
  method: 'GET',
  emits: [],
  flows: ['customer-support'],
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const handler: ApiRouteHandler<{}, ApiResponse, never> = async (req, { logger, state }) => {
  // Extract requestId from path - format: /api/support/response/:requestId
  const pathParts = req.path?.split('/') || []
  const requestId = pathParts[pathParts.length - 1] || ''

  logger.info('[GetResponse] 📤 Fetching response', { requestId })

  try {
    const responseData = await state.get<any>('responses', requestId)

    if (!responseData) {
      return {
        status: 404,
        body: {
          success: false,
          error: 'Response not found',
          message: 'No response found for the given requestId. The request may have expired or never existed.',
          requestId,
        },
      }
    }

    logger.info('[GetResponse] ✅ Response found', {
      requestId,
      status: responseData.status,
      agent: responseData.agent,
    })

    return {
      status: 200,
      body: {
        success: true,
        requestId,
        status: responseData.status,
        agent: responseData.agent,
        response: responseData.response,
        query: responseData.query,
        createdAt: responseData.createdAt,
        completedAt: responseData.completedAt,
        communicatedBy: responseData.communicatedBy,
        customerData: responseData.customerData,
        audioUrl: responseData.audioUrl,
      },
    }

  } catch (error: any) {
    logger.error('[GetResponse] ❌ Error fetching response', {
      requestId,
      error: error?.message,
    })

    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to fetch response',
        message: error?.message,
        requestId,
      },
    }
  }
}

