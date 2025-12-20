/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📊 RCA REPORT HANDLER - Terminal Event Handler for RCA Reports
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * This step receives RCA report generated events and handles them.
 * Can be extended to send reports via email, Slack, or store for dashboards.
 */

import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'

const inputSchema = z.object({
    generated_at: z.string(),
    total_failures: z.number(),
    top_failure_type: z.object({
        type: z.string(),
        count: z.number(),
        percentage: z.number(),
    }).optional(),
    top_gateway: z.object({
        name: z.string(),
        count: z.number(),
        percentage: z.number(),
    }).optional(),
    top_agent: z.object({
        name: z.string(),
        count: z.number(),
        percentage: z.number(),
    }).optional(),
    ai_summary: z.string().optional(),
})

type InputType = z.infer<typeof inputSchema>

export const config: EventConfig = {
    type: 'event',
    name: 'RCAReportHandler',
    description: 'Terminal handler for RCA report generated events. Logs reports and can trigger notifications.',
    subscribes: ['rca.report.generated'],
    emits: [],
    input: inputSchema as any,
    flows: ['rca'],
}

export const handler: EventHandler<InputType> = async (input, { logger, state }) => {
    const { generated_at, total_failures, top_failure_type, top_gateway, top_agent, ai_summary } = input

    logger.info('[RCAReportHandler] 📊 Received RCA report', {
        generated_at,
        total_failures,
    })

    // Store the report summary in state
    const reportId = `rca_handled_${Date.now()}`
    await state.set('rca_handled_reports', reportId, {
        generated_at,
        total_failures,
        top_failure_type,
        top_gateway,
        top_agent,
        has_ai_summary: !!ai_summary,
        handledAt: new Date().toISOString(),
    })

    // Log formatted report
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 RCA REPORT GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: ${generated_at}
Total Failures: ${total_failures}
${top_failure_type ? `Top Failure: ${top_failure_type.type} (${top_failure_type.count} - ${top_failure_type.percentage.toFixed(1)}%)` : ''}
${top_gateway ? `Top Gateway: ${top_gateway.name} (${top_gateway.count} - ${top_gateway.percentage.toFixed(1)}%)` : ''}
${top_agent ? `Top Agent: ${top_agent.name} (${top_agent.count} - ${top_agent.percentage.toFixed(1)}%)` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${ai_summary ? `\nAI Summary:\n${ai_summary.substring(0, 500)}${ai_summary.length > 500 ? '...' : ''}` : ''}
`)

    logger.info('[RCAReportHandler] ✅ Report processed', { reportId, total_failures })
}
