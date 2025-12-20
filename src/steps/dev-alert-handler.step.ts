/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔔 DEV ALERT HANDLER - Terminal Event Handler for Sentinel Alerts
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * This step receives dev alerts from Agent Sentinel and logs them.
 * Acts as a terminal handler for the monitoring pipeline.
 */

import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
    incident_id: z.string(),
    service_name: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    summary: z.string(),
    notification_channels: z.array(z.string()),
    requestId: z.string(),
    timestamp: z.string(),
})

type InputType = z.infer<typeof inputSchema>

export const config: EventConfig = {
    type: 'event',
    name: 'DevAlertHandler',
    description: 'Terminal handler for dev alerts sent by Agent Sentinel. Logs alerts and can trigger external integrations.',
    subscribes: ['dev.alert.sent'],
    emits: [],
    input: inputSchema as any,
    flows: ['sre-monitoring'],
}

export const handler: EventHandler<InputType> = async (input, { logger, state }) => {
    const { incident_id, service_name, severity, summary, notification_channels, timestamp } = input

    logger.info('[DevAlertHandler] 🔔 Received dev alert', {
        incident_id,
        service_name,
        severity,
        channels: notification_channels,
        timestamp,
    })

    // Store the alert in state for dashboard/history
    await state.set('dev_alerts', incident_id, {
        incident_id,
        service_name,
        severity,
        summary,
        notification_channels,
        timestamp,
        handledAt: new Date().toISOString(),
    })

    // Log with severity-based formatting
    const severityEmoji: Record<string, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🔵',
        info: '⚪',
    }

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${severityEmoji[severity] || '⚪'} DEV ALERT: ${severity.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Incident: ${incident_id}
Service: ${service_name}
Channels: ${notification_channels.join(', ')}
Time: ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

    logger.info('[DevAlertHandler] ✅ Alert processed and stored', { incident_id })
}
