import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { analyzeFailures, formatReportForLogging } from '../lib/rcaEngine'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'GetRCAReport',
  description: 'Get RCA analysis report on demand. Returns failure statistics and AI-generated summary.',
  path: '/api/rca/report',
  method: 'GET',
  emits: [],
  flows: ['rca'],
  queryParams: [
    { name: 'hours', description: 'Number of hours to look back (default: 24)' },
    { name: 'format', description: 'Output format: json or text (default: json)' },
  ],
}

export const handler: ApiRouteHandler<unknown, ApiResponse, never> = async (req, { logger }) => {
  // Parse query params manually
  const hoursParam = req.queryParams.hours as string | undefined
  const formatParam = req.queryParams.format as string | undefined
  
  const hours = hoursParam ? parseInt(hoursParam) : 24
  const format = formatParam || 'json'
  
  logger.info('[RCA API] Generating report', { hours, format })
  
  try {
    // Generate full analysis
    const report = await analyzeFailures({
      hoursBack: hours,
      includeAISummary: true,
    })
    
    if (format === 'text') {
      const textReport = formatReportForLogging(report)
      return {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: textReport as any,
      }
    }
    
    // Return JSON format
    return {
      status: 200,
      body: {
        success: true,
        report: {
          generated_at: report.generated_at.toISOString(),
          time_window: {
            from: report.time_window.from.toISOString(),
            to: report.time_window.to.toISOString(),
            hours: report.time_window.hours,
          },
          summary: report.summary,
          time_analysis: report.time_analysis,
          patterns: report.patterns,
          insights: report.insights,
          ai_summary: report.ai_summary,
        },
      },
    }
  } catch (error: any) {
    logger.error('[RCA API] Failed to generate report', { error: error?.message })
    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to generate RCA report',
        message: error?.message,
      },
    }
  }
}
