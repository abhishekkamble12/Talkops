import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { connectToDb } from '../lib/db'
import { Customer } from '../models/Customer'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// User info schema matching what Agents.step sends
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
  data: { response: string; customerData?: any; requestId: string }
}

export const config: EventConfig = {
  type: 'event',
  name: 'Agent_hulk',
  description: 'Agent hulk helps users with payment failures and customer care issues.',
  subscribes: ['google.hulkRequest'],
  emits: ['hulk.response'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

// Search for customer data using userInfo
async function retrieveCustomerData(query: string, userInfo?: UserInfo) {
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

  let customer = null
  if (exactMatchConditions.length > 0) {
    customer = await Customer.findOne({
      $or: exactMatchConditions,
    }).lean()
  }

  if (!customer) {
    customer = await Customer.findOne({
      $or: [
        { email: query.toLowerCase() },
        { customerId: query },
        { 'orders.orderId': query },
      ],
    }).lean()
  }

  if (!customer) {
    const regex = new RegExp(query, 'i')
    customer = await Customer.findOne({
      $or: [{ name: regex }, { email: regex }],
    }).lean()
  }

  return customer
}

// Format customer payment data for AI
function formatPaymentDataForAI(customer: any): string {
  if (!customer) return 'No customer data found.'

  const paymentIssues = customer.orders?.filter(
    (order: any) => order.issue?.type === 'payment_failed'
  )

  return `
Customer Information:
- Name: ${customer.name}
- Email: ${customer.email}
- Phone: ${customer.phone}
- Customer ID: ${customer.customerId}

Payment Issues:
${
  paymentIssues?.length > 0
    ? paymentIssues
        .map(
          (order: any) => `
  Order ID: ${order.orderId}
  Product: ${order.productName}
  Amount: $${order.price}
  Order Date: ${new Date(order.orderDate).toLocaleDateString()}
  Issue: ${order.issue?.description || 'Payment failed'}
  Status: ${order.issue?.isResolved ? 'Resolved' : 'Pending'}
`
        )
        .join('\n')
    : 'No payment issues found.'
}

All Orders:
${customer.orders?.map((o: any) => `- ${o.orderId}: ${o.productName} - $${o.price} (${o.shipmentStatus})`).join('\n') || 'No orders'}
`
}

// Fallback response when AI is unavailable
function generateFallbackResponse(customerData: any, text: string): string {
  if (!customerData) {
    return `Thank you for contacting us about your payment concern.

We're here to help! To assist you better, please have the following ready:
• Your order ID or email address
• Details about the payment issue

Common payment issues we can help with:
✓ Failed transactions
✓ Refund requests  
✓ Billing questions
✓ Card authorization issues

Contact our Customer Care team:
📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT (1-800-787-7678)
🕐 Hours: Monday-Friday 9AM-6PM EST

We'll get your issue resolved as quickly as possible!`
  }

  const paymentIssues = customerData.orders?.filter(
    (o: any) => o.issue?.type === 'payment_failed'
  ) || []

  if (paymentIssues.length > 0) {
    const order = paymentIssues[0]
    return `Hello ${customerData.name},

We found a payment issue with your account:
• Order ID: ${order.orderId}
• Product: ${order.productName}
• Amount: $${order.price}
• Issue: Payment Failed

To resolve this, please try:
1. Verify your card details are correct
2. Ensure sufficient funds are available
3. Contact your bank if the issue persists

Our team can also help process an alternative payment method.

Contact Customer Care:
📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT (1-800-787-7678)
🕐 Hours: Monday-Friday 9AM-6PM EST`
  }

  return `Hello ${customerData.name},

Thank you for reaching out about your payment inquiry.

Your account email: ${customerData.email}
Orders on file: ${customerData.orders?.length || 0}

For payment-related assistance, our Customer Care team is ready to help:
📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT (1-800-787-7678)
🕐 Hours: Monday-Friday 9AM-6PM EST

We're committed to resolving your concern promptly!`
}

const systemPrompt = `You are Agent Hulk, a customer support specialist for payment and billing issues.
Your job is to help customers with:
1. Payment failures and declined transactions
2. Refund requests and status
3. Billing inquiries
4. Connecting them with customer care if needed

Be empathetic and professional. Provide clear steps to resolve payment issues.
If the customer needs to contact support, provide helpful information:
- Customer Care Email: support@company.com
- Phone: 1-800-SUPPORT (1-800-787-7678)
- Hours: Monday-Friday 9AM-6PM EST

Always reassure the customer that their issue will be resolved.`

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger, state }) => {
  const { text, userInfo, requestId } = input

  logger.info('[Agent Hulk] Received query', { text, userInfo, requestId })

  try {
    // Retrieve customer data
    const customerData = await retrieveCustomerData(text, userInfo)

    if (!customerData) {
      logger.warn('[Agent Hulk] No customer found', { text })

      let aiResponse: string
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Customer query: "${text}"\n\nNo customer data found. Please provide a helpful response about payment issues and how to contact customer care.`,
                },
              ],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        })
        aiResponse = response.text ?? generateFallbackResponse(null, text)
      } catch (aiError: any) {
        logger.warn('[Agent Hulk] AI call failed, using fallback', { error: aiError?.message })
        aiResponse = generateFallbackResponse(null, text)
      }

      // Store response in state for frontend to retrieve
      await state.set('responses', requestId, {
        status: 'completed',
        agent: 'hulk',
        response: aiResponse,
        query: text,
        completedAt: new Date().toISOString(),
      })

      await emit({
        topic: 'hulk.response',
        data: { response: aiResponse, requestId },
      })

      logger.info('[Agent Hulk] Sent response for unknown customer', { requestId })
      return
    }

    // Format customer data for AI
    const formattedData = formatPaymentDataForAI(customerData)

    logger.info('[Agent Hulk] Found customer data', { customerId: customerData.customerId })

    let aiResponse: string
    try {
      // Generate AI response
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Customer query: "${text}"\n\nCustomer Data:\n${formattedData}\n\nPlease help this customer with their payment issue or direct them to customer care.`,
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
      aiResponse = response.text ?? generateFallbackResponse(customerData, text)
    } catch (aiError: any) {
      logger.warn('[Agent Hulk] AI call failed, using fallback', { error: aiError?.message })
      aiResponse = generateFallbackResponse(customerData, text)
    }

    // Store response in state for frontend to retrieve
    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'hulk',
      response: aiResponse,
      query: text,
      customerData: {
        customerId: customerData.customerId,
        name: customerData.name,
        email: customerData.email,
      },
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'hulk.response',
      data: {
        response: aiResponse,
        requestId,
        customerData: {
          customerId: customerData.customerId,
          name: customerData.name,
          email: customerData.email,
        },
      },
    })

    logger.info('[Agent Hulk] Successfully processed query', {
      customerId: customerData.customerId,
      requestId,
    })
  } catch (error: any) {
    logger.error('[Agent Hulk] Error processing query', { error: error?.message })

    const fallbackResponse = generateFallbackResponse(null, text)

    // Store error response in state
    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'hulk',
      response: fallbackResponse,
      query: text,
      error: error?.message,
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'hulk.response',
      data: {
        response: fallbackResponse,
        requestId,
      },
    })
  }
}
