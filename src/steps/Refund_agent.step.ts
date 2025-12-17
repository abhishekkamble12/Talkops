import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { connectToDb } from '../lib/db'
import { Customer, ICustomer } from '../models/Customer'

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
  fraudCheckPassed: z.boolean().optional(),
  fraudReason: z.string().optional(),
  customerData: z.any().optional(),
  orderData: z.any().optional(),
})

type InputType = z.infer<typeof inputSchema>
type UserInfo = z.infer<typeof userInfoSchema>

type EmitData = {
  topic: 'refund.response'
  data: { 
    response: string
    requestId: string
    refundApproved: boolean
    refundAmount?: number
    refundId?: string
    customerData?: any 
  }
}

export const config: EventConfig = {
  type: 'event',
  name: 'RefundAgent',
  description: 'Processes approved refund requests after fraud detection. Generates refund ID and confirmation.',
  subscribes: ['google.refund.requested'],
  emits: ['refund.response'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

const systemPrompt = `You are Agent Refund, a customer support specialist for processing refunds.
You ONLY receive requests that have already passed fraud detection.

Your job is to:
1. Confirm the refund details with the customer
2. Explain the refund timeline (3-5 business days)
3. Provide the refund confirmation number
4. Be empathetic and professional

Important information to include:
- Refund ID (will be provided)
- Expected timeline: 3-5 business days
- Refund method: Original payment method
- Support contact for questions: support@company.com or 1-800-SUPPORT

Always be positive and reassuring since the refund has been approved.`

function generateRefundId(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `REF-${timestamp}-${random}`
}

function formatRefundDataForAI(customerData: any, orderData: any, refundId: string): string {
  let formatted = `
Refund Request Details:
- Refund ID: ${refundId}
- Status: APPROVED ✅
`

  if (customerData) {
    formatted += `
Customer Information:
- Name: ${customerData.name || 'N/A'}
- Email: ${customerData.email || 'N/A'}
- Customer ID: ${customerData.customerId || 'N/A'}
`
  }

  if (orderData) {
    formatted += `
Order Information:
- Order ID: ${orderData.orderId || 'N/A'}
- Product: ${orderData.productName || 'N/A'}
- Amount: $${orderData.price || 0}
- Order Date: ${orderData.orderDate ? new Date(orderData.orderDate).toLocaleDateString() : 'N/A'}
- Current Status: ${orderData.shipmentStatus || 'N/A'}
`
  }

  formatted += `
Refund Timeline:
- Processing Time: 3-5 business days
- Refund Method: Original payment method
- Confirmation: Email will be sent
`

  return formatted
}

function generateFallbackResponse(customerData: any, orderData: any, refundId: string): string {
  const customerName = customerData?.name || 'Valued Customer'
  const orderIdStr = orderData?.orderId || 'your order'
  const amount = orderData?.price ? `$${orderData.price}` : 'the full amount'

  return `✅ Refund Approved!

Dear ${customerName},

Great news! Your refund request for ${orderIdStr} has been approved.

📋 Refund Details:
- Refund ID: ${refundId}
- Amount: ${amount}
- Timeline: 3-5 business days
- Method: Original payment method

You will receive a confirmation email shortly.

If you have any questions, please contact us:
📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT

Thank you for your patience!`
}

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger, state }) => {
  const { text, userInfo, requestId, enableVoiceResponse, fraudCheckPassed, customerData, orderData } = input

  logger.info('[RefundAgent] Processing approved refund request', { 
    requestId, 
    fraudCheckPassed,
    hasCustomerData: !!customerData,
    hasOrderData: !!orderData,
  })

  // Double-check fraud check passed (safety measure)
  if (!fraudCheckPassed) {
    logger.error('[RefundAgent] ❌ Received request without fraud check approval!', { requestId })
    
    const errorMessage = 'This refund request has not been verified. Please submit your request again.'
    
    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'refund',
      response: errorMessage,
      query: text,
      refundApproved: false,
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'refund.response',
      data: {
        response: errorMessage,
        requestId,
        refundApproved: false,
      },
    })
    return
  }

  try {
    // Generate unique refund ID
    const refundId = generateRefundId()
    const refundAmount = orderData?.price || 0

    logger.info('[RefundAgent] Generated refund ID', { refundId, refundAmount, requestId })

    // Format data for AI
    const formattedData = formatRefundDataForAI(customerData, orderData, refundId)

    let aiResponse: string

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Customer request: "${text}"\n\n${formattedData}\n\nPlease provide a friendly refund confirmation message.`,
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

      aiResponse = response.text ?? generateFallbackResponse(customerData, orderData, refundId)
    } catch (aiError: any) {
      logger.warn('[RefundAgent] AI call failed, using fallback', { error: aiError?.message })
      aiResponse = generateFallbackResponse(customerData, orderData, refundId)
    }

    // Store successful refund in state
    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'refund',
      response: aiResponse,
      query: text,
      refundApproved: true,
      refundId,
      refundAmount,
      customerData,
      completedAt: new Date().toISOString(),
    })

    // Emit refund response
    await emit({
      topic: 'refund.response',
      data: {
        response: aiResponse,
        requestId,
        refundApproved: true,
        refundId,
        refundAmount,
        customerData,
      },
    })

    logger.info('[RefundAgent] ✅ Refund processed successfully', {
      requestId,
      refundId,
      refundAmount,
      customerId: customerData?.customerId,
    })

  } catch (error: any) {
    logger.error('[RefundAgent] Error processing refund', { error: error?.message, requestId })

    const errorMessage = 'We encountered an issue processing your refund. Please try again or contact support at support@company.com.'

    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'refund',
      response: errorMessage,
      query: text,
      refundApproved: false,
      error: error?.message,
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'refund.response',
      data: {
        response: errorMessage,
        requestId,
        refundApproved: false,
      },
    })
  }
}

