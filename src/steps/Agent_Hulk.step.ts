/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 💳 AGENT HULK - Payment & Billing Agent
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * RESPONSIBILITIES:
 * - Handle payment failures and billing inquiries
 * - Assist with transaction issues
 * - Help with payment method updates
 * - Investigate charges and billing questions
 * - NOTE: Does NOT handle refunds (those go to fraud detector)
 */

import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { connectToDb } from '../lib/db'
import { Customer, ICustomer } from '../models/Customer'
import { Payment, IPayment } from '../models/Payment'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

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

type EmitData = {
    topic: 'hulk.response'
    data: {
        response: string
        agentState?: any
        requestId: string
        enableVoiceResponse?: boolean
        sourceAgent: 'hulk'
        customerData?: {
            customerId?: string
            name?: string
            email?: string
            ordersCount?: number
        }
    }
}

export const config: EventConfig = {
    type: 'event',
    name: 'Agent_Hulk',
    description: 'HULK - Payment & Billing Agent. Handles payment failures, transaction issues, and billing inquiries. Does NOT handle refunds.',
    subscribes: ['google.hulkRequest'],
    emits: ['hulk.response'],
    input: inputSchema as any,
    flows: ['customer-support'],
}

const systemPrompt = `You are Agent Hulk, a specialized payment and billing support agent.

Your responsibilities:
1. Investigate payment failures and declined transactions
2. Help with billing inquiries and charge questions
3. Assist with payment method updates
4. Explain transaction details
5. Troubleshoot payment issues

IMPORTANT: You do NOT handle refund requests. If customer asks for a refund, politely explain that refund requests are handled by a specialized team and they should resubmit their request specifically asking for a refund.

When responding:
- Be clear about payment statuses
- Explain any charges or fees
- Provide next steps for resolution
- Be helpful and professional

If customer data is provided, use it to give personalized responses.
If no payment data is found, apologize and ask for more details.`

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

async function retrievePaymentData(customerId?: string, orderId?: string): Promise<IPayment[]> {
    await connectToDb()

    const conditions: any[] = []
    if (customerId) conditions.push({ customerId })
    if (orderId) conditions.push({ orderId })

    if (conditions.length === 0) return []

    const payments = await Payment.find({
        $or: conditions,
    }).sort({ createdAt: -1 }).limit(5).lean() as IPayment[]

    return payments
}

function formatPaymentDataForAI(customer: ICustomer | null, payments: IPayment[], orderId?: string): string {
    if (!customer) {
        return 'No customer data found. Ask the customer for their order ID or email.'
    }

    let formatted = `
Customer Information:
- Name: ${customer.name || 'N/A'}
- Email: ${customer.email || 'N/A'}
- Customer ID: ${customer.customerId || 'N/A'}
`

    if (payments.length > 0) {
        formatted += `\nRecent Payment History:\n`
        payments.forEach((payment, index) => {
            formatted += `
Payment ${index + 1}:
- Transaction ID: ${payment.transactionId || 'N/A'}
- Amount: $${payment.amount || 0}
- Status: ${payment.status || 'N/A'}
- Method: ${payment.paymentMethod || 'N/A'}
- Date: ${payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : 'N/A'}
${payment.failureReason ? `- Failure Reason: ${payment.failureReason}` : ''}
`
        })
    }

    // Check for order-specific payment issues
    if (orderId && customer.orders) {
        const order = customer.orders.find(o => o.orderId === orderId)
        if (order) {
            formatted += `
Order Details (${orderId}):
- Product: ${order.productName || 'N/A'}
- Price: $${order.price || 0}
- Status: ${order.shipmentStatus || 'N/A'}
${order.issue?.type === 'payment_failed' ? `- Issue: Payment failed - ${order.issue.description}` : ''}
`
        }
    }

    return formatted
}

function generateFallbackResponse(customer: ICustomer | null, payments: IPayment[]): string {
    if (!customer) {
        return `I apologize, but I couldn't find any account information matching your details.

Could you please provide:
- Your order confirmation number
- Or the email address associated with your account

This will help me locate your payment information and assist you better.`
    }

    if (payments.length === 0) {
        return `Hello ${customer.name || 'there'}! I found your account but couldn't locate any recent payment records. 

Could you provide more details about the payment or charge you're inquiring about? This could be:
- The transaction date
- The approximate amount
- Your order ID

I'm here to help resolve any billing concerns!`
    }

    const latestPayment = payments[0]
    return `Hello ${customer.name || 'there'}!

I found your recent payment information:
- Transaction: ${latestPayment.transactionId}
- Amount: $${latestPayment.amount}
- Status: ${latestPayment.status}
- Date: ${latestPayment.createdAt ? new Date(latestPayment.createdAt).toLocaleDateString() : 'N/A'}

How can I help you with this transaction?`
}

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger, state }) => {
    const { text, userInfo, requestId, enableVoiceResponse } = input

    logger.info('[Agent Hulk] 💳 Processing payment inquiry', { text, userInfo, requestId })

    try {
        // Retrieve customer data
        const customer = await retrieveCustomerData(text, userInfo)

        logger.info('[Agent Hulk] Customer lookup result', {
            found: !!customer,
            customerId: customer?.customerId,
            requestId,
        })

        // Retrieve payment data
        const payments = await retrievePaymentData(customer?.customerId, userInfo?.orderId)

        logger.info('[Agent Hulk] Payment lookup result', {
            paymentsFound: payments.length,
            requestId,
        })

        // Format data for AI
        const formattedData = formatPaymentDataForAI(customer, payments, userInfo?.orderId)

        let aiResponse: string

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `Customer query: "${text}"\n\n${formattedData}\n\nProvide a helpful response about their payment/billing issue.`,
                            },
                        ],
                    },
                ],
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.7,
                    maxOutputTokens: 600,
                },
            })

            aiResponse = response.text ?? generateFallbackResponse(customer, payments)
        } catch (aiError: any) {
            logger.warn('[Agent Hulk] AI call failed, using fallback', { error: aiError?.message })
            aiResponse = generateFallbackResponse(customer, payments)
        }

        // Store response in state
        await state.set('responses', requestId, {
            status: 'completed',
            agent: 'hulk',
            response: aiResponse,
            query: text,
            customerData: customer ? {
                customerId: customer.customerId,
                name: customer.name,
            } : undefined,
            completedAt: new Date().toISOString(),
        })

        // Emit response for Aisha to transform
        await emit({
            topic: 'hulk.response',
            data: {
                response: aiResponse,
                requestId,
                enableVoiceResponse,
                sourceAgent: 'hulk',
                customerData: customer ? {
                    customerId: customer.customerId,
                    name: customer.name,
                    email: customer.email,
                    ordersCount: customer.orders?.length || 0,
                } : undefined,
            },
        })

        logger.info('[Agent Hulk] ✅ Response sent', { requestId })

    } catch (error: any) {
        logger.error('[Agent Hulk] Error processing request', { error: error?.message, requestId })

        const errorMessage = 'I apologize, but I encountered an issue looking up your payment information. Please try again or contact support at support@company.com.'

        await state.set('responses', requestId, {
            status: 'completed',
            agent: 'hulk',
            response: errorMessage,
            query: text,
            error: error?.message,
            completedAt: new Date().toISOString(),
        })

        await emit({
            topic: 'hulk.response',
            data: {
                response: errorMessage,
                requestId,
                enableVoiceResponse,
                sourceAgent: 'hulk',
            },
        })
    }
}
