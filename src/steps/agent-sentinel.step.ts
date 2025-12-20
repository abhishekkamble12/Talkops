/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🚨 AGENT SENTINEL - Site Reliability / DevOps Agent
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * RESPONSIBILITIES:
 * - Monitor system health events (website down, API timeout, DB unreachable)
 * - Decide severity using policies
 * - Notify developers via Slack/Email/PagerDuty/Console
 * - Generate AI-written incident summaries
 * - NEVER notify customers directly
 */

import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { generateIncidentSummary } from '../lib/gemini'
import { logSystemFailure } from '../lib/failureLogger'

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'
type NotificationChannel = 'slack' | 'email' | 'pagerduty' | 'console'

const healthEventSchema = z.object({
  event_type: z.enum(['system.health.down', 'system.health.degraded', 'system.health.recovering', 'system.health.alert']),
  service_name: z.string(),
  status: z.enum(['down', 'degraded', 'recovering', 'healthy']),
  error_rate: z.number().optional(),
  latency_ms: z.number().optional(),
  error_message: z.string().optional(),
  affected_endpoints: z.array(z.string()).optional(),
  started_at: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  requestId: z.string(),
})

type HealthEventInput = z.infer<typeof healthEventSchema>

interface SentinelAgentState {
  service_name: string
  current_status: string
  severity_level: SeverityLevel
  outage_duration_minutes: number
  error_rate_percent: number
  latency_ms: number | null
  affected_endpoints: string[]
  error_details: string | null
  escalation_required: boolean
  notification_channels: NotificationChannel[]
  policy_applied: string
}

type EmitData = {
  topic: 'dev.alert.sent'
  data: {
    incident_id: string
    service_name: string
    severity: SeverityLevel
    summary: string
    notification_channels: NotificationChannel[]
    requestId: string
    timestamp: string
  }
}

export const config: EventConfig = {
  type: 'event',
  name: 'Agent_Sentinel_V2',
  description: 'SENTINEL - Autonomous SRE/DevOps agent. Monitors system health, determines severity, and notifies developers.',
  subscribes: ['system.health.down', 'system.health.degraded', 'system.health.recovering', 'system.health.alert'],
  emits: ['dev.alert.sent'],
  input: healthEventSchema as any,
  flows: ['sre-monitoring'],
}

// Severity Policies
interface SeverityPolicy {
  name: string
  condition: (s: Partial<SentinelAgentState>) => boolean
  severity: SeverityLevel
  channels: NotificationChannel[]
  escalate: boolean
}

const SEVERITY_POLICIES: SeverityPolicy[] = [
  { name: 'CRITICAL_OUTAGE', condition: (s) => s.current_status === 'down' && (s.outage_duration_minutes || 0) > 5, severity: 'critical', channels: ['pagerduty', 'slack', 'email'], escalate: true },
  { name: 'HIGH_ERROR_RATE', condition: (s) => (s.error_rate_percent || 0) > 50, severity: 'high', channels: ['slack', 'email'], escalate: true },
  { name: 'SERVICE_DOWN', condition: (s) => s.current_status === 'down', severity: 'high', channels: ['slack', 'pagerduty'], escalate: true },
  { name: 'DEGRADED', condition: (s) => s.current_status === 'degraded', severity: 'medium', channels: ['slack'], escalate: false },
  { name: 'RECOVERING', condition: (s) => s.current_status === 'recovering', severity: 'info', channels: ['slack'], escalate: false },
]

function determineSeverity(state: Partial<SentinelAgentState>) {
  for (const policy of SEVERITY_POLICIES) {
    if (policy.condition(state)) return { policy, applied: policy.name }
  }
  return { policy: { severity: 'info' as SeverityLevel, channels: ['console'] as NotificationChannel[], escalate: false }, applied: 'DEFAULT' }
}

async function sendNotification(channel: NotificationChannel, incident_id: string, service_name: string, severity: SeverityLevel, summary: string) {
  const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' }
  console.log(`[${channel.toUpperCase()}] ${emoji[severity]} ${severity.toUpperCase()}: ${service_name} - ${incident_id}`)
  console.log(summary.substring(0, 300))
}

const SENTINEL_PROMPT = `You are Agent Sentinel, an SRE agent. Generate concise incident summaries for developers only.
Include: IMPACT, ROOT CAUSE HYPOTHESIS, IMMEDIATE ACTIONS, INVESTIGATION STEPS.
Be technical but concise. Use bullet points.`

export const handler: EventHandler<HealthEventInput, EmitData> = async (input, { emit, logger, state }) => {
  const { service_name, status, requestId } = input
  const incident_id = `INC-${Date.now()}-${service_name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)}`

  logger.info('[Agent Sentinel] 🚨 Received health event', { service_name, status, incident_id })

  try {
    const startedAt = input.started_at ? new Date(input.started_at) : new Date()
    const outageMinutes = Math.round((Date.now() - startedAt.getTime()) / (1000 * 60))

    const partialState: Partial<SentinelAgentState> = {
      service_name,
      current_status: status,
      outage_duration_minutes: outageMinutes,
      error_rate_percent: input.error_rate || 0,
      latency_ms: input.latency_ms || null,
      affected_endpoints: input.affected_endpoints || [],
      error_details: input.error_message || null,
    }

    const { policy, applied } = determineSeverity(partialState)

    const agentState: SentinelAgentState = {
      ...partialState as SentinelAgentState,
      severity_level: policy.severity,
      escalation_required: policy.escalate,
      notification_channels: policy.channels,
      policy_applied: applied,
    }

    logger.info('[Agent Sentinel] 📊 State built', { severity: agentState.severity_level, policy: applied })

    // Log for RCA
    if (agentState.severity_level === 'critical' || agentState.severity_level === 'high') {
      logSystemFailure({
        agent_name: 'sentinel',
        request_id: requestId,
        gateway: service_name,
        error_message: agentState.error_details || `Service ${status}`,
        correlation_id: incident_id,
        metadata: { severity: agentState.severity_level, outage_minutes: outageMinutes },
      })
    }

    // Generate AI summary
    let incidentSummary: string
    const eventDetails = `Service: ${service_name}, Status: ${status}, Error Rate: ${input.error_rate || 0}%`
    const llmResult = await generateIncidentSummary(SENTINEL_PROMPT, eventDetails, agentState)

    if (llmResult.success) {
      incidentSummary = llmResult.text
    } else {
      incidentSummary = `📋 INCIDENT: ${incident_id}\n🎯 Service: ${service_name} (${status})\n⚠️ Severity: ${agentState.severity_level}\n📝 ${agentState.error_details || 'No details'}`
    }

    // Send notifications
    for (const channel of agentState.notification_channels) {
      await sendNotification(channel, incident_id, service_name, agentState.severity_level, incidentSummary)
    }

    // Store incident
    await state.set('incidents', incident_id, {
      incident_id,
      service_name,
      status,
      severity: agentState.severity_level,
      summary: incidentSummary,
      created_at: new Date().toISOString(),
    })

    // Emit event
    await emit({
      topic: 'dev.alert.sent',
      data: {
        incident_id,
        service_name,
        severity: agentState.severity_level,
        summary: incidentSummary,
        notification_channels: agentState.notification_channels,
        requestId,
        timestamp: new Date().toISOString(),
      },
    })

    logger.info('[Agent Sentinel] ✅ Incident processed', { incident_id, severity: agentState.severity_level })
  } catch (error: any) {
    logger.error('[Agent Sentinel] 💥 Error', { error: error?.message, incident_id })
    console.log(`[CONSOLE] SENTINEL ERROR: Failed to process ${service_name}`)
  }
}

