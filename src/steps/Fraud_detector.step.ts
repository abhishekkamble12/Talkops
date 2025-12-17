import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { connectToDb } from '../lib/db'
import { Customer, ICustomer } from '../models/Customer'

// User info schema
const userInfoSchema = z.object({
  email: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  trackingNumber: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
})

const inputSchema = z.object({
  text: z.string(),
  userInfo: userInfoSchema.optional(),
  requestId: z.string(),
  enableVoiceResponse: z.boolean().optional(),
})

type InputType = z.infer<typeof inputSchema>
type UserInfo = z.infer<typeof userInfoSchema>

type AgentData = {
  text: string
  userInfo?: UserInfo
  requestId: string
  enableVoiceResponse?: boolean
  fraudCheckPassed?: boolean
  fraudReason?: string
  customerData?: any
  orderData?: any
}

type EmitData =
  | { topic: 'google.refund.requested'; data: AgentData }
  | { topic: 'fraud.response'; data: { response: string; requestId: string; fraudDetected: boolean; reason?: string; customerData?: any } }

export const config: EventConfig = {
  type: 'event',
  name: 'FraudDetector',
  description: 'Validates refund requests for fraud before passing to refund agent. Checks order history, refund patterns, and suspicious activity.',
  subscribes: ['google.fraud_detectorRequest'],
  emits: ['google.refund.requested', 'fraud.response'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

// Fraud detection rules and thresholds
const FRAUD_RULES = {
  // Maximum refunds allowed in last 30 days
  MAX_RECENT_REFUNDS: 3,
  // Minimum order age (hours) before refund is allowed
  MIN_ORDER_AGE_HOURS: 1,
  // Maximum refund amount without extra verification ($)
  MAX_AUTO_REFUND_AMOUNT: 500,
  // Days to look back for refund history
  REFUND_HISTORY_DAYS: 30,
}

interface FraudCheckResult {
  passed: boolean
  reason?: string
  riskScore: number // 0-100, higher = more risky
  flags: string[]
}

async function retrieveCustomerData(query: string, userInfo?: UserInfo): Promise<ICustomer | null> {
  await connectToDb()

  const exactMatchConditions: any[] = []

  if (userInfo?.email) {
    exactMatchConditions.push({ email: userInfo.email.toLowerCase() })
  }
  if (userInfo?.customerId) {
    exactMatchConditions.push({ customerId: userInfo.customerId })
  }
  if (userInfo?.orderId) {
    exactMatchConditions.push({ 'orders.orderId': userInfo.orderId })
  }
  if (userInfo?.phone) {
    exactMatchConditions.push({ phone: userInfo.phone })
  }

  let customer: ICustomer | null = null
  
  if (exactMatchConditions.length > 0) {
    customer = await Customer.findOne({
      $or: exactMatchConditions,
    }).lean() as ICustomer | null
  }

  if (!customer) {
    customer = await Customer.findOne({
      $or: [
        { email: query.toLowerCase() },
        { customerId: query },
        { 'orders.orderId': query },
      ],
    }).lean() as ICustomer | null
  }

  return customer
}

function performFraudCheck(customer: ICustomer | null, orderId?: string): FraudCheckResult {
  const flags: string[] = []
  let riskScore = 0

  // Check 1: Customer exists
  if (!customer) {
    return {
      passed: false,
      reason: 'Customer not found in our system. Please verify your account details.',
      riskScore: 100,
      flags: ['CUSTOMER_NOT_FOUND'],
    }
  }

  // Check 2: Find the specific order if orderId provided
  let targetOrder = null
  if (orderId) {
    targetOrder = customer.orders?.find(o => o.orderId === orderId)
    if (!targetOrder) {
      return {
        passed: false,
        reason: `Order ${orderId} not found for this customer.`,
        riskScore: 80,
        flags: ['ORDER_NOT_FOUND'],
      }
    }
  }

  // Check 3: Order age - too new orders might be fraud
  if (targetOrder) {
    const orderDate = new Date(targetOrder.orderDate)
    const hoursSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceOrder < FRAUD_RULES.MIN_ORDER_AGE_HOURS) {
      flags.push('ORDER_TOO_NEW')
      riskScore += 30
    }

    // Check if already delivered - higher risk for refund after delivery
    if (targetOrder.shipmentStatus === 'delivered') {
      flags.push('ALREADY_DELIVERED')
      riskScore += 20
    }

    // Check if order already has an issue marked
    if (targetOrder.issue?.type === 'payment_failed') {
      flags.push('PAYMENT_ALREADY_FAILED')
      riskScore += 10
    }

    // High value order
    if (targetOrder.price > FRAUD_RULES.MAX_AUTO_REFUND_AMOUNT) {
      flags.push('HIGH_VALUE_ORDER')
      riskScore += 15
    }
  }

  // Check 4: Recent refund history
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - FRAUD_RULES.REFUND_HISTORY_DAYS)

  const recentRefunds = customer.orders?.filter(order => {
    const orderDate = new Date(order.orderDate)
    return orderDate > thirtyDaysAgo && order.shipmentStatus === 'returned'
  }).length || 0

  if (recentRefunds >= FRAUD_RULES.MAX_RECENT_REFUNDS) {
    flags.push('EXCESSIVE_REFUNDS')
    riskScore += 40
    return {
      passed: false,
      reason: `Too many refund requests (${recentRefunds}) in the last 30 days. Please contact customer support.`,
      riskScore,
      flags,
    }
  } else if (recentRefunds >= 2) {
    flags.push('MULTIPLE_RECENT_REFUNDS')
    riskScore += 20
  }

  // Check 5: Account age - new accounts are higher risk
  const accountAge = customer.createdAt ? 
    (Date.now() - new Date(customer.createdAt).getTime()) / (1000 * 60 * 60 * 24) : 0
  
  if (accountAge < 7) {
    flags.push('NEW_ACCOUNT')
    riskScore += 15
  }

  // Check 6: Missing contact info is suspicious
  if (!customer.phone && !customer.email) {
    flags.push('NO_CONTACT_INFO')
    riskScore += 25
  }

  // Final decision based on risk score
  if (riskScore >= 70) {
    return {
      passed: false,
      reason: 'This refund request requires manual review due to risk factors. Please contact customer support.',
      riskScore,
      flags,
    }
  }

  return {
    passed: true,
    riskScore,
    flags,
  }
}

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger, state }) => {
  const { text, userInfo, requestId, enableVoiceResponse } = input

  logger.info('[FraudDetector] Analyzing refund request', { text, userInfo, requestId })

  try {
    // Retrieve customer data
    const customer = await retrieveCustomerData(text, userInfo)

    logger.info('[FraudDetector] Customer lookup result', {
      found: !!customer,
      customerId: customer?.customerId,
      requestId,
    })

    // Perform fraud check
    const fraudCheck = performFraudCheck(customer, userInfo?.orderId)

    logger.info('[FraudDetector] Fraud check result', {
      passed: fraudCheck.passed,
      riskScore: fraudCheck.riskScore,
      flags: fraudCheck.flags,
      requestId,
    })

    if (fraudCheck.passed) {
      // ✅ Fraud check passed - forward to refund agent
      logger.info('[FraudDetector] ✅ Fraud check PASSED, forwarding to Refund Agent', { requestId })

      await emit({
        topic: 'google.refund.requested',
        data: {
          text,
          userInfo,
          requestId,
          enableVoiceResponse,
          fraudCheckPassed: true,
          customerData: customer ? {
            customerId: customer.customerId,
            name: customer.name,
            email: customer.email,
          } : undefined,
          orderData: userInfo?.orderId ? customer?.orders?.find(o => o.orderId === userInfo.orderId) : undefined,
        },
      })

      // Also emit a fraud response for tracking
      await emit({
        topic: 'fraud.response',
        data: {
          response: `Fraud check passed (Risk Score: ${fraudCheck.riskScore}/100). Refund request is being processed.`,
          requestId,
          fraudDetected: false,
          customerData: customer ? {
            customerId: customer.customerId,
            name: customer.name,
          } : undefined,
        },
      })
    } else {
      // ❌ Fraud check failed - block refund
      logger.warn('[FraudDetector] ❌ Fraud check FAILED, blocking refund', {
        reason: fraudCheck.reason,
        riskScore: fraudCheck.riskScore,
        flags: fraudCheck.flags,
        requestId,
      })

      const blockMessage = `🚫 Refund Request Blocked\n\n${fraudCheck.reason}\n\nRisk Flags: ${fraudCheck.flags.join(', ')}\n\nIf you believe this is an error, please contact our customer support team at support@company.com or call 1-800-SUPPORT.`

      // Update state with blocked refund
      await state.set('responses', requestId, {
        status: 'completed',
        agent: 'fraud_detector',
        response: blockMessage,
        query: text,
        fraudDetected: true,
        fraudReason: fraudCheck.reason,
        riskScore: fraudCheck.riskScore,
        completedAt: new Date().toISOString(),
      })

      await emit({
        topic: 'fraud.response',
        data: {
          response: blockMessage,
          requestId,
          fraudDetected: true,
          reason: fraudCheck.reason,
          customerData: customer ? {
            customerId: customer.customerId,
            name: customer.name,
          } : undefined,
        },
      })
    }
  } catch (error: any) {
    logger.error('[FraudDetector] Error during fraud check', { error: error?.message, requestId })

    // On error, block for safety
    const errorMessage = 'Unable to verify refund request at this time. Please try again later or contact customer support.'

    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'fraud_detector',
      response: errorMessage,
      query: text,
      error: error?.message,
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'fraud.response',
      data: {
        response: errorMessage,
        requestId,
        fraudDetected: true,
        reason: 'System error during verification',
      },
    })
  }
}

