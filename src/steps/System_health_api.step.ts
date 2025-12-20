import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEM HEALTH API - Triggers for Agent Sentinel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// This API allows external monitoring systems to report health events
// which are then processed by Agent Sentinel for autonomous response
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const healthEventBodySchema = z.object({
  service_name: z.string().min(1, 'service_name is required'),
  status: z.enum(['down', 'degraded', 'recovering', 'healthy']),
  error_rate: z.number().min(0).max(100).optional(),
  latency_ms: z.number().min(0).optional(),
  error_message: z.string().optional(),
  affected_endpoints: z.array(z.string()).optional(),
  started_at: z.string().optional(), // ISO timestamp
  metadata: z.record(z.any()).optional(),
})

type HealthEventBody = z.infer<typeof healthEventBodySchema>

type EmitData = 
  | { topic: 'system.health.down'; data: HealthEventBody & { event_type: string; requestId: string } }
  | { topic: 'system.health.degraded'; data: HealthEventBody & { event_type: string; requestId: string } }
  | { topic: 'system.health.recovering'; data: HealthEventBody & { event_type: string; requestId: string } }
  | { topic: 'system.health.alert'; data: HealthEventBody & { event_type: string; requestId: string } }

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'SystemHealthReport',
  description: 'API endpoint for external systems to report health events. Triggers Agent Sentinel for autonomous incident response.',
  path: '/api/system/health',
  method: 'POST',
  emits: ['system.health.down', 'system.health.degraded', 'system.health.recovering', 'system.health.alert'],
  bodySchema: healthEventBodySchema as any,
  flows: ['sre-monitoring'],
}

export const handler: ApiRouteHandler<HealthEventBody, ApiResponse, EmitData> = async (req, { emit, logger, state }) => {
  const requestId = randomUUID()
  const body = req.body

  logger.info('[SystemHealthAPI] 🏥 Received health report', {
    service_name: body.service_name,
    status: body.status,
    error_rate: body.error_rate,
    requestId,
  })

  // Determine which event topic to emit based on status
  let eventTopic: 'system.health.down' | 'system.health.degraded' | 'system.health.recovering' | 'system.health.alert'
  let eventType: string

  switch (body.status) {
    case 'down':
      eventTopic = 'system.health.down'
      eventType = 'system.health.down'
      break
    case 'degraded':
      eventTopic = 'system.health.degraded'
      eventType = 'system.health.degraded'
      break
    case 'recovering':
      eventTopic = 'system.health.recovering'
      eventType = 'system.health.recovering'
      break
    case 'healthy':
    default:
      eventTopic = 'system.health.alert'
      eventType = 'system.health.alert'
      break
  }

  // Store the health event
  const healthEventId = `health-${requestId}`
  await state.set('health-events', healthEventId, {
    ...body,
    event_type: eventType,
    requestId,
    reported_at: new Date().toISOString(),
  })

  // Emit to Agent Sentinel
  await emit({
    topic: eventTopic,
    data: {
      ...body,
      event_type: eventType,
      requestId,
    },
  } as EmitData)

  logger.info('[SystemHealthAPI] ✅ Health event emitted to Sentinel', {
    topic: eventTopic,
    service_name: body.service_name,
    requestId,
  })

  return {
    status: 200,
    body: {
      status: 'Accepted',
      message: `Health event for ${body.service_name} is being processed by Agent Sentinel`,
      event_type: eventType,
      requestId,
    },
  }
}
