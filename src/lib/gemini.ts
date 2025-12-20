/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🧠 GEMINI AI CLIENT - Unified LLM Interface for Autonomous Agents
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * This module provides a centralized, type-safe interface to Google's Gemini API.
 * All agents use this module for consistent LLM interactions.
 * 
 * USAGE RULES:
 * - LLMs must receive: user query + structured agentState JSON
 * - LLMs must reason about: missing vs available info, next steps, actions
 * - LLMs must NOT: hallucinate system actions, invent data, expose internal errors
 */

import { GoogleGenAI } from '@google/genai'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES & INTERFACES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface GeminiConfig {
  model?: string
  temperature?: number
  maxOutputTokens?: number
}

export interface AgentReasoningRequest {
  systemPrompt: string
  userQuery: string
  agentState: Record<string, any>
  config?: GeminiConfig
}

export interface GeminiResponse {
  text: string
  success: boolean
  error?: string
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLETON CLIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let geminiClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }
    geminiClient = new GoogleGenAI({ apiKey })
  }
  return geminiClient
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEFAULT CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_CONFIG: Required<GeminiConfig> = {
  model: 'gemini-2.0-flash',
  temperature: 0.85,
  maxOutputTokens: 300,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGENT REASONING FUNCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generates a reasoned response from the LLM based on agent state.
 * 
 * This function structures the prompt to ensure the LLM:
 * 1. Receives the user query and structured agent state
 * 2. Reasons about the situation based on available data
 * 3. Generates appropriate responses without hallucination
 * 
 * @param request - The reasoning request containing system prompt, query, and state
 * @returns Promise<GeminiResponse> - The LLM's response or error
 */
export async function generateAgentReasoning(
  request: AgentReasoningRequest
): Promise<GeminiResponse> {
  try {
    const client = getGeminiClient()
    const config = { ...DEFAULT_CONFIG, ...request.config }

    const userContent = `CUSTOMER QUERY: "${request.userQuery}"

AGENT STATE (JSON - use this data for your response):
${JSON.stringify(request.agentState, null, 2)}

Based on this state, reason about the situation and provide a helpful response. Remember: only reference data from agentState, never invent information.`

    const response = await client.models.generateContent({
      model: config.model,
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      config: {
        systemInstruction: request.systemPrompt,
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
      },
    })

    const text = response.text ?? ''
    
    if (!text) {
      return {
        text: '',
        success: false,
        error: 'Empty response from LLM',
      }
    }

    return {
      text: text.trim(),
      success: true,
    }
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: error?.message || 'Unknown LLM error',
    }
  }
}

/**
 * Generates an incident summary for SRE/DevOps purposes.
 * Uses a different configuration optimized for technical reports.
 */
export async function generateIncidentSummary(
  systemPrompt: string,
  eventDetails: string,
  agentState: Record<string, any>
): Promise<GeminiResponse> {
  try {
    const client = getGeminiClient()

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${eventDetails}

AGENT STATE (JSON):
${JSON.stringify(agentState, null, 2)}

Generate a concise incident summary for the SRE team. Focus on impact, immediate actions, and investigation steps.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7, // Lower temperature for consistent technical output
        maxOutputTokens: 400,
      },
    })

    const text = response.text ?? ''
    
    if (!text) {
      return {
        text: '',
        success: false,
        error: 'Empty response from LLM',
      }
    }

    return {
      text: text.trim(),
      success: true,
    }
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: error?.message || 'Unknown LLM error',
    }
  }
}

/**
 * Transforms agent responses for voice-friendly customer communication.
 * Uses higher temperature for natural variation in phrasing.
 */
export async function transformForVoice(
  systemPrompt: string,
  originalResponse: string,
  context: Record<string, any>
): Promise<GeminiResponse> {
  try {
    const client = getGeminiClient()

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `INTERNAL AGENT RESPONSE:
"${originalResponse}"

COMMUNICATION CONTEXT:
${JSON.stringify(context, null, 2)}

Transform this internal response into a warm, empathetic, voice-friendly customer message. Make it sound natural when spoken aloud. Do NOT add any information not in the original response.`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.9, // Higher for natural variation
        maxOutputTokens: 250,
      },
    })

    const text = response.text ?? ''
    
    if (!text) {
      return {
        text: '',
        success: false,
        error: 'Empty response from LLM',
      }
    }

    // Clean up markdown formatting for voice
    const cleanedText = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/```[^`]*```/g, '')
      .trim()

    return {
      text: cleanedText,
      success: true,
    }
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: error?.message || 'Unknown LLM error',
    }
  }
}

/**
 * Simple text generation for routing decisions.
 * Uses very low temperature for consistent classification.
 */
export async function classifyQuery(
  systemPrompt: string,
  query: string
): Promise<GeminiResponse> {
  try {
    const client = getGeminiClient()

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: query }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3, // Very low for consistent routing
        maxOutputTokens: 50,
      },
    })

    const text = response.text?.trim().toLowerCase() ?? ''
    
    return {
      text,
      success: !!text,
      error: text ? undefined : 'Empty classification response',
    }
  } catch (error: any) {
    return {
      text: '',
      success: false,
      error: error?.message || 'Unknown LLM error',
    }
  }
}

export { getGeminiClient }

