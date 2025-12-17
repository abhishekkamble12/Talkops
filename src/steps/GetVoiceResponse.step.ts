import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'getVoiceResponse',
  description: 'Retrieves voice response status, text response, and audio URL',
  path: '/api/voice/response/:requestId',
  method: 'GET',
  emits: [],
  flows: ['customer-support'],
}

interface ResponseData {
  status: string
  requestId: string
  query: string
  response?: string
  agent?: string
  customerData?: any
  enableVoiceResponse?: boolean
  isVoiceRequest?: boolean
  audioUrl?: string
  audioReady?: boolean
  audioError?: string
  createdAt?: string
  completedAt?: string
  audioGeneratedAt?: string
}

export const handler: ApiRouteHandler<unknown, ApiResponse, never> = async (req, { logger, state }) => {
  const { requestId } = req.pathParams

  if (!requestId) {
    return {
      status: 400,
      body: { 
        error: 'requestId is required',
        status: 'error',
      },
    }
  }

  logger.info('[GetVoiceResponse] Fetching response', { requestId })

  try {
    const responseData = await state.get<ResponseData>('responses', requestId)

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

    logger.info('[GetVoiceResponse] Found response', { 
      requestId, 
      status: responseData.status,
      audioReady: responseData.audioReady,
    })

    return {
      status: 200,
      body: {
        status: responseData.status,
        requestId,
        query: responseData.query,
        agent: responseData.agent,
        response: responseData.response,
        customerData: responseData.customerData,
        // Voice specific fields
        isVoiceRequest: responseData.isVoiceRequest ?? false,
        enableVoiceResponse: responseData.enableVoiceResponse ?? false,
        audioUrl: responseData.audioUrl,
        audioReady: responseData.audioReady ?? false,
        audioError: responseData.audioError,
        // Timestamps
        createdAt: responseData.createdAt,
        completedAt: responseData.completedAt,
        audioGeneratedAt: responseData.audioGeneratedAt,
      },
    }
  } catch (error: any) {
    logger.error('[GetVoiceResponse] Error fetching response', { 
      error: error?.message, 
      requestId 
    })

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

