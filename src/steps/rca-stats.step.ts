import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { getQuickStats } from '../lib/rcaEngine'
import { getStoreStats } from '../lib/failureStore'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetRCAStats',
  description: 'Get quick RCA statistics without AI summarization (faster endpoint).',
  path: '/api/rca/stats',
  method: 'GET',
  emits: [],
  flows: ['rca'],
  queryParams: [
    { name: 'hours', description: 'Number of hours to look back (default: 24)' },
  ],
}

export const handler: ApiRouteHandler<unknown, ApiResponse, never> = async (req, { logger }) => {
  // Parse query params manually
  const hoursParam = req.queryParams.hours as string | undefined
  const hours = hoursParam ? parseInt(hoursParam) : 24
  
  logger.info('[RCA Stats API] Getting quick stats', { hours })
  
  try {
    const stats = getQuickStats(hours)
    const storeStats = getStoreStats()
    
    return {
      status: 200,
      body: {
        success: true,
        time_window_hours: hours,
        stats: {
          ...stats,
          store: storeStats,
        },
      },
    }
  } catch (error: any) {
    logger.error('[RCA Stats API] Failed to get stats', { error: error?.message })
    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to get RCA stats',
      },
    }
  }
}
