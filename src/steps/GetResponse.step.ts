import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { z } from 'zod'

const queryParamsSchema = z.object({
  requestId: z.string(),
})

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'getResponse',
  description: 'Retrieves the response for a given requestId',
  path: '/api/order/response/:requestId',
  method: 'GET',
  emits: [],
  flows: ['customer-support'],
  queryParams: [
    { name: 'requestId', description: 'The unique request ID returned from the query endpoint' }
  ],
}

export const handler: ApiRouteHandler<unknown, ApiResponse, never> = async (req, { logger, state }) => {
  const { requestId } = req.pathParams

  logger.info('[GetResponse] Fetching response', { requestId })

  if (!requestId) {
    return {
      status: 400,
      body: { 
        error: 'requestId is required',
        status: 'error',
      },
    }
  }

  try {
    const responseData = await state.get<{
      status: string
      agent: string
      response: string
      query: string
      customerData?: any
      error?: string
      createdAt?: string
      completedAt?: string
    }>('responses', requestId)

    if (!responseData) {
      return {
        status: 404,
        body: { 
          error: 'Response not found. The request may still be processing or the requestId is invalid.',
          status: 'not_found',
          requestId,
        },
      }
    }

    logger.info('[GetResponse] Found response', { requestId, status: responseData.status })

    return {
      status: 200,
      body: {
        status: responseData.status,
        requestId,
        agent: responseData.agent,
        response: responseData.response,
        query: responseData.query,
        customerData: responseData.customerData,
        completedAt: responseData.completedAt,
      },
    }
  } catch (error: any) {
    logger.error('[GetResponse] Error fetching response', { error: error?.message, requestId })

    return {
      status: 500,
      body: { 
        error: 'Failed to retrieve response',
        status: 'error',
        requestId,
      },
    }
  }
}

