/**
 * RCA Demo - Example usage and output demonstration
 * 
 * Run with: npx ts-node --esm src/lib/rca-demo.ts
 * 
 * This file demonstrates:
 * 1. How to log failures from different agents
 * 2. How aggregation works
 * 3. Example RCA report output
 * 4. Example AI-generated summary
 */

import { logPaymentFailure, logFraudFailure, logShippingFailure } from './failureLogger'
import { analyzeFailures, formatReportForLogging, getQuickStats } from './rcaEngine'
import { getStoreStats, clearFailureEvents } from './failureStore.js'

async function runDemo() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║           RCA (Root Cause Analysis) DEMO                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')
  
  // Clear any existing events
  clearFailureEvents()
  console.log('🧹 Cleared existing failure events\n')
  
  // ============================================================
  // 1. SIMULATE FAILURES
  // ============================================================
  console.log('📝 STEP 1: Simulating failures from different agents...\n')
  
  // Simulate payment failures
  for (let i = 0; i < 15; i++) {
    logPaymentFailure({
      agent_name: 'hulk',
      request_id: `req-pay-${i}`,
      gateway: i < 12 ? 'stripe' : 'paypal',  // 80% stripe, 20% paypal
      error_message: i % 3 === 0 ? 'Card declined' : 'Insufficient funds',
      metadata: { amount: Math.random() * 500 },
    })
  }
  console.log('   ✓ Logged 15 payment failures (12 Stripe, 3 PayPal)\n')
  
  // Simulate fraud detection failures
  for (let i = 0; i < 8; i++) {
    logFraudFailure({
      agent_name: 'fraud_detector',
      request_id: `req-fraud-${i}`,
      gateway: 'refund_validation',
      error_message: i % 2 === 0 ? 'Excessive refunds' : 'High risk score',
      metadata: { riskScore: 70 + Math.random() * 30 },
    })
  }
  console.log('   ✓ Logged 8 fraud detection failures\n')
  
  // Simulate shipping failures
  for (let i = 0; i < 10; i++) {
    const carriers = ['fedex', 'fedex', 'fedex', 'fedex', 'fedex', 'ups', 'ups', 'usps', 'usps', 'dhl']
    logShippingFailure({
      agent_name: 'havoc',
      request_id: `req-ship-${i}`,
      gateway: carriers[i],  // 50% fedex
      error_message: i < 6 ? 'Delivery delayed - weather' : 'Package lost in transit',
      correlation_id: `ORD-${1000 + i}`,
    })
  }
  console.log('   ✓ Logged 10 shipping failures (5 FedEx, 2 UPS, 2 USPS, 1 DHL)\n')
  
  // ============================================================
  // 2. SHOW STORE STATS
  // ============================================================
  console.log('📊 STEP 2: Store Statistics\n')
  const storeStats = getStoreStats()
  console.log(`   Total events stored: ${storeStats.total_events}`)
  console.log(`   Oldest event: ${storeStats.oldest_event?.toISOString()}`)
  console.log(`   Newest event: ${storeStats.newest_event?.toISOString()}\n`)
  
  // ============================================================
  // 3. QUICK STATS (no AI)
  // ============================================================
  console.log('⚡ STEP 3: Quick Stats (no AI call)\n')
  const quickStats = getQuickStats(24)
  console.log('   Quick Stats:', JSON.stringify(quickStats, null, 2), '\n')
  
  // ============================================================
  // 4. FULL RCA ANALYSIS
  // ============================================================
  console.log('🔍 STEP 4: Full RCA Analysis with AI Summary\n')
  
  try {
    const report = await analyzeFailures({
      hoursBack: 24,
      includeAISummary: true,
    })
    
    // Display formatted report
    console.log(formatReportForLogging(report))
    
    // ============================================================
    // 5. EXAMPLE JSON OUTPUT
    // ============================================================
    console.log('\n📄 STEP 5: Example JSON Output (for API response)\n')
    
    const jsonOutput = {
      generated_at: report.generated_at.toISOString(),
      time_window: {
        from: report.time_window.from.toISOString(),
        to: report.time_window.to.toISOString(),
        hours: report.time_window.hours,
      },
      summary: {
        total_failures: report.summary.total_failures,
        by_type: report.summary.by_type.map(t => ({
          type: t.key,
          count: t.count,
          percentage: t.percentage,
        })),
        by_gateway: report.summary.by_gateway.map(g => ({
          gateway: g.key,
          count: g.count,
          percentage: g.percentage,
        })),
      },
      insights: report.insights,
      ai_summary: report.ai_summary,
    }
    
    console.log(JSON.stringify(jsonOutput, null, 2))
    
  } catch (error: any) {
    console.log('\n⚠️  AI Summary failed (API key may be missing). Showing stats without AI:\n')
    
    const report = await analyzeFailures({
      hoursBack: 24,
      includeAISummary: false,
    })
    
    console.log(formatReportForLogging(report))
  }
  
  console.log('\n✅ Demo complete!')
}

// Run the demo
runDemo().catch(console.error)
