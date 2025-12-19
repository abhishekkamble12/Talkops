/**
 * RCA (Root Cause Analysis) Engine
 * 
 * Analyzes failure events and produces structured insights.
 * AI is used ONLY for summarization, NOT for decisions.
 */

import { GoogleGenAI } from '@google/genai'
import {
  getFailureEvents,
  getFailureCount,
  aggregateBy,
  getFailuresByHour,
  getPeakFailureHours,
  getGatewayFailureRanking,
  getRepeatedPatterns,
  getStoreStats,
} from './failureStore'
import type { FailureType, AggregatedFailure, TimeWindowStats } from './failureStore'

// Initialize AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

/**
 * RCA Report structure
 */
export interface RCAReport {
  generated_at: Date
  time_window: {
    from: Date
    to: Date
    hours: number
  }
  summary: {
    total_failures: number
    by_type: AggregatedFailure[]
    by_agent: AggregatedFailure[]
    by_gateway: AggregatedFailure[]
  }
  time_analysis: {
    peak_hours: TimeWindowStats[]
    hourly_distribution: TimeWindowStats[]
  }
  patterns: {
    repeated_failures: { pattern: string; count: number; agent: string; gateway?: string }[]
  }
  insights: {
    most_failing_gateway?: { name: string; percentage: number; count: number }
    most_failing_agent?: { name: string; percentage: number; count: number }
    peak_failure_window?: { hours: string; percentage: number }
    top_pattern?: { description: string; count: number }
  }
  ai_summary?: string
}

/**
 * Analyze failures for a given time window (in hours)
 */
export async function analyzeFailures(options?: {
  hoursBack?: number
  includeAISummary?: boolean
}): Promise<RCAReport> {
  const hoursBack = options?.hoursBack || 24  // Default: last 24 hours
  const includeAI = options?.includeAISummary !== false  // Default: true
  
  const now = new Date()
  const since = new Date(now.getTime() - hoursBack * 60 * 60 * 1000)
  
  // Gather all statistics
  const totalFailures = getFailureCount({ since })
  const byType = aggregateBy('failure_type', { since })
  const byAgent = aggregateBy('agent_name', { since })
  const byGateway = getGatewayFailureRanking({ since })
  const peakHours = getPeakFailureHours(3, { since })
  const hourlyDistribution = getFailuresByHour({ since })
  const repeatedPatterns = getRepeatedPatterns({ since, minOccurrences: 2 })
  
  // Build insights
  const insights: RCAReport['insights'] = {}
  
  if (byGateway.length > 0) {
    insights.most_failing_gateway = {
      name: byGateway[0].key,
      percentage: byGateway[0].percentage,
      count: byGateway[0].count,
    }
  }
  
  if (byAgent.length > 0) {
    insights.most_failing_agent = {
      name: byAgent[0].key,
      percentage: byAgent[0].percentage,
      count: byAgent[0].count,
    }
  }
  
  if (peakHours.length > 0) {
    const peakHourRange = peakHours.map(h => h.hour)
    const minHour = Math.min(...peakHourRange)
    const maxHour = Math.max(...peakHourRange)
    insights.peak_failure_window = {
      hours: peakHourRange.length === 1 
        ? `${formatHour(minHour)}` 
        : `${formatHour(minHour)}-${formatHour(maxHour + 1)}`,
      percentage: peakHours.reduce((sum, h) => sum + h.percentage, 0),
    }
  }
  
  if (repeatedPatterns.length > 0) {
    insights.top_pattern = {
      description: `${repeatedPatterns[0].agent} agent with ${repeatedPatterns[0].gateway || 'unknown'} gateway`,
      count: repeatedPatterns[0].count,
    }
  }
  
  // Build the report
  const report: RCAReport = {
    generated_at: now,
    time_window: {
      from: since,
      to: now,
      hours: hoursBack,
    },
    summary: {
      total_failures: totalFailures,
      by_type: byType,
      by_agent: byAgent,
      by_gateway: byGateway,
    },
    time_analysis: {
      peak_hours: peakHours,
      hourly_distribution: hourlyDistribution,
    },
    patterns: {
      repeated_failures: repeatedPatterns,
    },
    insights,
  }
  
  // Generate AI summary if requested and there are failures
  if (includeAI && totalFailures > 0) {
    try {
      report.ai_summary = await generateAISummary(report)
    } catch (error: any) {
      console.error('[RCAEngine] AI summary failed:', error?.message)
      report.ai_summary = generateFallbackSummary(report)
    }
  } else if (totalFailures === 0) {
    report.ai_summary = 'No failures recorded in the specified time window.'
  }
  
  return report
}

/**
 * Format hour to human-readable string
 */
function formatHour(hour: number): string {
  const h = hour % 24
  if (h === 0) return '12 AM'
  if (h === 12) return '12 PM'
  if (h < 12) return `${h} AM`
  return `${h - 12} PM`
}

/**
 * Generate AI summary from aggregated statistics
 * AI is ONLY used for summarization - decisions remain rule-based
 */
async function generateAISummary(report: RCAReport): Promise<string> {
  // Build statistics text for the LLM
  const statsText = buildStatsText(report)
  
  const systemPrompt = `You are an assistant that summarizes failure analysis reports.
Your job is to create a 1-2 sentence natural language summary of the provided statistics.
DO NOT make any recommendations or decisions.
DO NOT suggest actions to take.
ONLY describe what the data shows in plain English.
Keep it factual and concise.`
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [{ text: `Summarize these failure statistics in 1-2 sentences:\n\n${statsText}` }],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      maxOutputTokens: 150,
    },
  })
  
  return response.text?.trim() || generateFallbackSummary(report)
}

/**
 * Build human-readable statistics text for AI
 */
function buildStatsText(report: RCAReport): string {
  const lines: string[] = []
  
  lines.push(`Time window: Last ${report.time_window.hours} hours`)
  lines.push(`Total failures: ${report.summary.total_failures}`)
  
  if (report.summary.by_type.length > 0) {
    lines.push('\nFailures by type:')
    for (const item of report.summary.by_type) {
      lines.push(`  - ${item.key}: ${item.count} (${item.percentage}%)`)
    }
  }
  
  if (report.summary.by_agent.length > 0) {
    lines.push('\nFailures by agent:')
    for (const item of report.summary.by_agent) {
      lines.push(`  - ${item.key}: ${item.count} (${item.percentage}%)`)
    }
  }
  
  if (report.summary.by_gateway.length > 0) {
    lines.push('\nFailures by gateway/carrier:')
    for (const item of report.summary.by_gateway) {
      lines.push(`  - ${item.key}: ${item.count} (${item.percentage}%)`)
    }
  }
  
  if (report.time_analysis.peak_hours.length > 0) {
    lines.push('\nPeak failure hours:')
    for (const item of report.time_analysis.peak_hours) {
      lines.push(`  - ${formatHour(item.hour)}: ${item.count} failures (${item.percentage}%)`)
    }
  }
  
  if (report.patterns.repeated_failures.length > 0) {
    lines.push('\nRepeated failure patterns:')
    for (const pattern of report.patterns.repeated_failures.slice(0, 3)) {
      lines.push(`  - ${pattern.agent} + ${pattern.gateway || 'unknown'}: ${pattern.count} times`)
    }
  }
  
  return lines.join('\n')
}

/**
 * Generate fallback summary when AI is unavailable
 */
function generateFallbackSummary(report: RCAReport): string {
  const parts: string[] = []
  
  parts.push(`${report.summary.total_failures} failures recorded in the last ${report.time_window.hours} hours.`)
  
  if (report.insights.most_failing_gateway) {
    parts.push(
      `${report.insights.most_failing_gateway.percentage}% of failures occurred with ${report.insights.most_failing_gateway.name}.`
    )
  }
  
  if (report.insights.peak_failure_window) {
    parts.push(
      `Peak failures occurred between ${report.insights.peak_failure_window.hours}.`
    )
  }
  
  return parts.join(' ')
}

/**
 * Get a quick stats summary (no AI)
 */
export function getQuickStats(hoursBack: number = 24): {
  total_failures: number
  top_failure_type?: { type: string; count: number; percentage: number }
  top_gateway?: { name: string; count: number; percentage: number }
  top_agent?: { name: string; count: number; percentage: number }
} {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
  
  const total = getFailureCount({ since })
  const byType = aggregateBy('failure_type', { since })
  const byGateway = getGatewayFailureRanking({ since })
  const byAgent = aggregateBy('agent_name', { since })
  
  return {
    total_failures: total,
    top_failure_type: byType[0] ? {
      type: byType[0].key,
      count: byType[0].count,
      percentage: byType[0].percentage,
    } : undefined,
    top_gateway: byGateway[0] ? {
      name: byGateway[0].key,
      count: byGateway[0].count,
      percentage: byGateway[0].percentage,
    } : undefined,
    top_agent: byAgent[0] ? {
      name: byAgent[0].key,
      count: byAgent[0].count,
      percentage: byAgent[0].percentage,
    } : undefined,
  }
}

/**
 * Format RCA report for logging
 */
export function formatReportForLogging(report: RCAReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════',
    '                    RCA ANALYSIS REPORT                     ',
    '═══════════════════════════════════════════════════════════',
    '',
    `Generated: ${report.generated_at.toISOString()}`,
    `Window: ${report.time_window.hours} hours (${report.time_window.from.toISOString()} → ${report.time_window.to.toISOString()})`,
    '',
    '📊 SUMMARY',
    `   Total Failures: ${report.summary.total_failures}`,
    '',
  ]
  
  if (report.summary.by_type.length > 0) {
    lines.push('   By Type:')
    for (const item of report.summary.by_type) {
      lines.push(`     • ${item.key}: ${item.count} (${item.percentage}%)`)
    }
    lines.push('')
  }
  
  if (report.summary.by_agent.length > 0) {
    lines.push('   By Agent:')
    for (const item of report.summary.by_agent) {
      lines.push(`     • ${item.key}: ${item.count} (${item.percentage}%)`)
    }
    lines.push('')
  }
  
  if (report.summary.by_gateway.length > 0) {
    lines.push('   By Gateway:')
    for (const item of report.summary.by_gateway) {
      lines.push(`     • ${item.key}: ${item.count} (${item.percentage}%)`)
    }
    lines.push('')
  }
  
  if (report.time_analysis.peak_hours.length > 0) {
    lines.push('⏰ PEAK FAILURE HOURS')
    for (const item of report.time_analysis.peak_hours) {
      lines.push(`     • ${formatHour(item.hour)}: ${item.count} failures (${item.percentage}%)`)
    }
    lines.push('')
  }
  
  if (report.patterns.repeated_failures.length > 0) {
    lines.push('🔄 REPEATED PATTERNS')
    for (const pattern of report.patterns.repeated_failures.slice(0, 5)) {
      lines.push(`     • ${pattern.agent} + ${pattern.gateway || 'none'}: ${pattern.count}x`)
    }
    lines.push('')
  }
  
  if (report.ai_summary) {
    lines.push('🤖 AI SUMMARY')
    lines.push(`   "${report.ai_summary}"`)
    lines.push('')
  }
  
  lines.push('═══════════════════════════════════════════════════════════')
  
  return lines.join('\n')
}

export type { FailureType, AggregatedFailure, TimeWindowStats }
