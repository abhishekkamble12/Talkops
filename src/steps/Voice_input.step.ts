import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Lazy initialization to avoid errors when GROQ_API_KEY is not set
let groqClient: Groq | null = null

function getGroqClient(): Groq {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY environment variable is not set. Please add it to your .env file.')
    }
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqClient
}

const userInfoSchema = z.object({
  email: z.string().optional(),
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  trackingNumber: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
})

const bodySchema = z.object({
  // Either text or audioBase64 is required
  text: z.string().optional(),
  audioBase64: z.string().optional(), // Base64 encoded audio
  userInfo: userInfoSchema.optional(),
  enableVoiceResponse: z.boolean().optional(),
})

type BodyType = z.infer<typeof bodySchema>
type UserInfo = z.infer<typeof userInfoSchema>

type EmitData = {
  topic: 'google.analyzequeryRequest'
  data: { text: string; userInfo?: UserInfo; requestId: string; enableVoiceResponse: boolean }
}

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'voiceInput',
  description: 'Receives voice/text input and routes to agents. Supports audio transcription via Groq Whisper.',
  path: '/api/voice/query',
  method: 'POST',
  emits: ['google.analyzequeryRequest'],
  bodySchema: bodySchema as any,
  flows: ['customer-support'],
}

export const handler: ApiRouteHandler<BodyType, ApiResponse, EmitData> = async (req, { emit, logger, state }) => {
  const { text, audioBase64, userInfo, enableVoiceResponse = true } = req.body
  const requestId = randomUUID()

  let queryText = text || ''

  // If audio is provided, transcribe it using Groq Whisper
  if (audioBase64 && !text) {
    try {
      logger.info('[VoiceInput] Transcribing audio...', { requestId })
      
      const audioBuffer = Buffer.from(audioBase64, 'base64')
      
      // Save temporarily for Groq API
      const tempDir = os.tmpdir()
      const tempPath = path.join(tempDir, `audio_${requestId}.wav`)
      await fs.promises.writeFile(tempPath, audioBuffer)

      // Transcribe using Groq Whisper
      const groq = getGroqClient()
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-large-v3',
        response_format: 'text',
      })

      queryText = typeof transcription === 'string' ? transcription : (transcription as any).text || ''
      
      // Clean up temp file
      await fs.promises.unlink(tempPath).catch(() => {})
      
      logger.info('[VoiceInput] Transcribed audio successfully', { 
        requestId, 
        transcription: queryText.substring(0, 100) 
      })
    } catch (error: any) {
      logger.error('[VoiceInput] Transcription failed', { 
        error: error?.message, 
        requestId 
      })
      return {
        status: 400,
        body: { 
          error: 'Failed to transcribe audio. Please try again or send text instead.',
          details: error?.message,
          requestId 
        },
      }
    }
  }

  if (!queryText || queryText.trim() === '') {
    return {
      status: 400,
      body: { 
        error: 'Either text or audioBase64 is required',
        requestId 
      },
    }
  }

  logger.info('[VoiceInput] Processing voice query', { 
    text: queryText.substring(0, 100), 
    requestId,
    enableVoiceResponse 
  })

  // Initialize state for tracking
  await state.set('responses', requestId, {
    status: 'processing',
    requestId,
    query: queryText,
    enableVoiceResponse,
    isVoiceRequest: true,
    createdAt: new Date().toISOString(),
  })

  // Route to existing agent flow
  await emit({
    topic: 'google.analyzequeryRequest',
    data: { 
      text: queryText, 
      userInfo, 
      requestId,
      enableVoiceResponse,
    },
  })

  return {
    status: 200,
    body: {
      status: 'Accepted',
      message: 'Your voice query is being processed',
      requestId,
      transcribedText: queryText,
      enableVoiceResponse,
    },
  }
}

