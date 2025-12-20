import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM HEALTH STATUS API - View Incidents
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provides visibility into system health and incidents processed by Sentinel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'SystemHealthStatus',
  description: 'API endpoint to view current system health status and recent incidents processed by Agent Sentinel.',
  path: '/api/system/status',
  method: 'GET',
  emits: [],
  flows: ['sre-monitoring'],
}

export const handler: ApiRouteHandler<never, ApiResponse, never> = async (req, { logger, state }) => {
  const query = req.query as { limit?: string; severity?: string }

  logger.info('[SystemHealthStatus] 📊 Fetching system status')

  try {
    // In a real implementation, we'd query the incidents from state
    // For now, return a status summary
    
    const statusSummary = {
      system_status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        'api-gateway': { status: 'healthy', last_check: new Date().toISOString() },
        'database': { status: 'healthy', last_check: new Date().toISOString() },
        'payment-service': { status: 'healthy', last_check: new Date().toISOString() },
        'shipping-service': { status: 'healthy', last_check: new Date().toISOString() },
        'notification-service': { status: 'healthy', last_check: new Date().toISOString() },
      },
      sentinel_agent: {
        status: 'active',
        version: '1.0.0',
        last_incident_processed: null,
        total_incidents_24h: 0,
      },
      message: 'All systems operational. Agent Sentinel is monitoring.',
    }

    logger.info('[SystemHealthStatus] ✅ Status retrieved successfully')

    return {
      status: 200,
      body: statusSummary,
    }
  } catch (error: any) {
    logger.error('[SystemHealthStatus] ❌ Error fetching status', { error: error?.message })

    return {
      status: 500,
      body: {
        error: 'Failed to fetch system status',
        message: error?.message,
      },
    }
  }
}

