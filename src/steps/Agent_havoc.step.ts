import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { connectToDb } from '../lib/db'
import { Customer, ICustomer } from '../models/Customer'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

// User info schema matching what Agents_step sends
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
  topic: 'havoc.response'
  data: { response: string; customerData?: any; requestId: string }
}

export const config: EventConfig = {
  type: 'event',
  name: 'Agent_havoc',
  description: 'Agent havoc fetches customer data from database and analyzes shipping delay issues.',
  subscribes: ['google.havocRequest'],
  emits: ['havoc.response'],
  input: inputSchema as any,
  flows: ['customer-support'],
}

// Search for customer data using userInfo first, then fall back to text query
async function retrieveCustomerData(query: string, userInfo?: UserInfo): Promise<ICustomer | null> {
  await connectToDb()

  // Build query conditions from userInfo (most reliable)
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
  if (userInfo?.trackingNumber) {
    exactMatchConditions.push({ 'orders.trackingNumber': userInfo.trackingNumber })
  }
  if (userInfo?.phone) {
    exactMatchConditions.push({ phone: userInfo.phone })
  }

  // Try exact match with userInfo first
  let customer: ICustomer | null = null
  if (exactMatchConditions.length > 0) {
    customer = await Customer.findOne({
      $or: exactMatchConditions,
    }).lean() as ICustomer | null
  }

  // If no match from userInfo, try with the text query
  if (!customer) {
    customer = await Customer.findOne({
      $or: [
        { email: query.toLowerCase() },
        { customerId: query },
        { 'orders.orderId': query },
        { 'orders.trackingNumber': query },
      ],
    }).lean() as ICustomer | null
  }

  // Try text search on the query
  if (!customer) {
    customer = await Customer.findOne({
      $text: { $search: query },
    }).lean() as ICustomer | null
  }

  // Try partial match on name or email from userInfo or query
  if (!customer) {
    const searchTerm = userInfo?.name || userInfo?.email || query
    const regex = new RegExp(searchTerm, 'i')
    customer = await Customer.findOne({
      $or: [{ name: regex }, { email: regex }],
    }).lean() as ICustomer | null
  }

  return customer
}

// Format customer data for AI analysis
function formatCustomerDataForAI(customer: any): string {
  if (!customer) return 'No customer data found.'

  const delayedOrders = customer.orders?.filter(
    (order: any) => order.shipmentStatus === 'delayed' || order.issue?.type !== 'none'
  )

  return `
Customer Information:
- Name: ${customer.name}
- Email: ${customer.email}
- Customer ID: ${customer.customerId}

Orders with Issues:
${
  delayedOrders?.length > 0
    ? delayedOrders
        .map(
          (order: any) => `
  Order ID: ${order.orderId}
  Product: ${order.productName}
  Status: ${order.shipmentStatus}
  Tracking: ${order.trackingNumber || 'N/A'}
  Carrier: ${order.carrier || 'N/A'}
  Estimated Delivery: ${order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString() : 'N/A'}
  Issue Type: ${order.issue?.type || 'none'}
  Issue Description: ${order.issue?.description || 'No description'}
  Issue Resolved: ${order.issue?.isResolved ? 'Yes' : 'No'}
`
        )
        .join('\n')
    : 'No delayed orders found.'
}

All Orders Summary:
${customer.orders?.map((o: any) => `- ${o.orderId}: ${o.productName} (${o.shipmentStatus})`).join('\n') || 'No orders'}
`
}

const systemPrompt = `You are Agent Havoc, a customer support specialist for shipping and delivery issues. 
Your job is to analyze customer data and explain:
1. What is the current status of their shipment
2. What is causing any delays (weather, customs, carrier issues, etc.)
3. What the customer can expect next
4. Any recommended actions

Be empathetic, clear, and helpful. If there are issues, explain them in simple terms.
If no issues are found, reassure the customer that their order is on track.`

// Fallback response when AI is unavailable
function generateFallbackResponse(customerData: any, text: string): string {
  if (!customerData) {
    return `Thank you for contacting us about your shipping inquiry.

To help you better, please provide one of the following:
• Your order ID (e.g., ORD-12345)
• Your email address
• Your tracking number

Once we have this information, we can look up your order status and help resolve any shipping delays.

For immediate assistance, contact our support team:
📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT`
  }

  const delayedOrders = customerData.orders?.filter(
    (o: any) => o.shipmentStatus === 'delayed' || o.issue?.type !== 'none'
  ) || []

  if (delayedOrders.length > 0) {
    const order = delayedOrders[0]
    return `Hello ${customerData.name},

We found your order information:
• Order ID: ${order.orderId}
• Product: ${order.productName}
• Status: ${order.shipmentStatus}
• Issue: ${order.issue?.type || 'None reported'}

${order.issue?.description ? `Details: ${order.issue.description}` : ''}

We apologize for any inconvenience. Our team is working to resolve this issue. You should receive an update within 24-48 hours.

For immediate assistance:
📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT`
  }

  return `Hello ${customerData.name},

Your order is currently being processed. Here's what we found:
${customerData.orders?.map((o: any) => `• ${o.orderId}: ${o.productName} (${o.shipmentStatus})`).join('\n') || 'No orders found'}

If you have concerns about delivery timing, please contact our support team.

📧 Email: support@company.com
📞 Phone: 1-800-SUPPORT`
}

export const handler: EventHandler<InputType, EmitData> = async (input, { emit, logger, state }) => {
  const { text, userInfo, requestId } = input

  logger.info('[Agent Havoc] Received query', { text, userInfo, requestId })

  try {
    // Retrieve customer data from database using both text query and userInfo
    const customerData = await retrieveCustomerData(text, userInfo)

    if (!customerData) {
      logger.warn('[Agent Havoc] No customer found for query', { text })

      let aiResponse: string
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Customer query: "${text}"\n\nNo customer data found in our system. Please provide a helpful response asking for more specific information like order ID, email, or tracking number.`,
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
        logger.warn('[Agent Havoc] AI call failed, using fallback', { error: aiError?.message })
        aiResponse = generateFallbackResponse(null, text)
      }

      // Store response in state for frontend to retrieve
      await state.set('responses', requestId, {
        status: 'completed',
        agent: 'havoc',
        response: aiResponse,
        query: text,
        completedAt: new Date().toISOString(),
      })

      await emit({
        topic: 'havoc.response',
        data: { response: aiResponse, requestId },
      })

      logger.info('[Agent Havoc] Sent response for unknown customer', { requestId })
      return
    }

    // Format customer data for AI
    const formattedData = formatCustomerDataForAI(customerData)

    logger.info('[Agent Havoc] Found customer data', { customerId: customerData.customerId })

    let aiResponse: string
    try {
      // Generate AI response based on customer data
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Customer query: "${text}"\n\nCustomer Data:\n${formattedData}\n\nPlease analyze this information and provide a helpful response about their shipping status and any issues.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      })
      aiResponse = response.text ?? generateFallbackResponse(customerData, text)
    } catch (aiError: any) {
      logger.warn('[Agent Havoc] AI call failed, using fallback', { error: aiError?.message })
      aiResponse = generateFallbackResponse(customerData, text)
    }

    // Store response in state for frontend to retrieve
    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'havoc',
      response: aiResponse,
      query: text,
      customerData: {
        customerId: customerData.customerId,
        name: customerData.name,
        ordersCount: customerData.orders?.length || 0,
      },
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'havoc.response',
      data: {
        response: aiResponse,
        requestId,
        customerData: {
          customerId: customerData.customerId,
          name: customerData.name,
          ordersCount: customerData.orders?.length || 0,
        },
      },
    })

    logger.info('[Agent Havoc] Successfully processed query', {
      customerId: customerData.customerId,
      requestId,
    })
  } catch (error: any) {
    logger.error('[Agent Havoc] Error processing query', { error: error?.message })

    const fallbackResponse = generateFallbackResponse(null, text)

    // Store error response in state
    await state.set('responses', requestId, {
      status: 'completed',
      agent: 'havoc',
      response: fallbackResponse,
      query: text,
      error: error?.message,
      completedAt: new Date().toISOString(),
    })

    await emit({
      topic: 'havoc.response',
      data: {
        response: fallbackResponse,
        requestId,
      },
    })
  }
}