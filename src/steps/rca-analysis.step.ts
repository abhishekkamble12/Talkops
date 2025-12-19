import { CronConfig, Handlers } from 'motia'
import { analyzeFailures, formatReportForLogging, getQuickStats } from '../lib/rcaEngine'

export const config: CronConfig = {
  type: 'cron',
  name: 'RCAAnalysisCron',
  description: 'Periodic RCA analysis - runs every hour to analyze failure patterns and generate AI summaries',
  cron: '0 * * * *',  // Every hour at minute 0
  emits: ['rca.report.generated'],
  flows: ['rca'],
}

type EmitData = {
  topic: 'rca.report.generated'
  data: {
    generated_at: string
    total_failures: number
    top_failure_type?: { type: string; count: number; percentage: number }
    top_gateway?: { name: string; count: number; percentage: number }
    top_agent?: { name: string; count: number; percentage: number }
    ai_summary?: string
  }
}

export const handler: Handlers['RCAAnalysisCron'] = async ({ logger, emit, state }) => {
  logger.info('[RCAAnalysisCron] Starting periodic RCA analysis')
  
  try {
    // Run full analysis for last 24 hours
    const report = await analyzeFailures({
      hoursBack: 24,
      includeAISummary: true,
    })
    
    // Log the formatted report
    const formattedReport = formatReportForLogging(report)
    logger.info('[RCAAnalysisCron] Analysis complete')
    console.log(formattedReport)
    
    // Store the report in state for later retrieval
    const reportId = `rca_${Date.now()}`
    await state.set<any>('rca_reports', reportId, {
      ...report,
      generated_at: report.generated_at.toISOString(),
      time_window: {
        from: report.time_window.from.toISOString(),
        to: report.time_window.to.toISOString(),
        hours: report.time_window.hours,
      },
    })
    
    // Store latest report reference
    await state.set<any>('rca_reports', 'latest', {
      report_id: reportId,
      generated_at: report.generated_at.toISOString(),
    })
    
    // Get quick stats for the emit
    const quickStats = getQuickStats(24)
    
    // Emit report generated event
    await (emit as any)({
      topic: 'rca.report.generated',
      data: {
        generated_at: report.generated_at.toISOString(),
        total_failures: report.summary.total_failures,
        top_failure_type: quickStats.top_failure_type,
        top_gateway: quickStats.top_gateway,
        top_agent: quickStats.top_agent,
        ai_summary: report.ai_summary,
      },
    })
    
    logger.info('[RCAAnalysisCron] Report generated and stored', {
      reportId,
      totalFailures: report.summary.total_failures,
      hasAISummary: !!report.ai_summary,
    })
    
  } catch (error: any) {
    logger.error('[RCAAnalysisCron] Analysis failed', { error: error?.message })
  }
}
