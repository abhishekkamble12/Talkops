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
      throw new Error('GROQ_API_KEY environment variable is not set')
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
  text: z.string().optional(),
  audioBase64: z.string().optional(),
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
  const requestId = randomUUID()

  try {
    const body = req.body || {}
    const text = body.text
    const audioBase64 = body.audioBase64
    const userInfo = body.userInfo
    const enableVoiceResponse = body.enableVoiceResponse !== false

    let queryText = text || ''

    // If audio is provided, transcribe it
    if (audioBase64 && !text) {
      // Check GROQ_API_KEY first
      if (!process.env.GROQ_API_KEY) {
        logger.error('[VoiceInput] GROQ_API_KEY not set', { requestId })
        return {
          status: 500,
          body: {
            error: 'Voice transcription not configured. GROQ_API_KEY missing.',
            message: 'Add GROQ_API_KEY to .env file. Get it from https://console.groq.com/',
            requestId,
          },
        }
      }

      try {
        logger.info('[VoiceInput] Transcribing audio...', { requestId })

        // Remove data URL prefix if present
        let cleanBase64 = audioBase64
        if (audioBase64.includes(',')) {
          cleanBase64 = audioBase64.split(',')[1]
        }

        const audioBuffer = Buffer.from(cleanBase64, 'base64')
        logger.info('[VoiceInput] Buffer size', { requestId, size: audioBuffer.length })

        // Save to temp file with short name
        const tempDir = os.tmpdir()
        const shortId = requestId.substring(0, 8)
        const tempPath = path.join(tempDir, `a${shortId}.webm`)

        await fs.promises.writeFile(tempPath, audioBuffer)
        logger.info('[VoiceInput] Saved temp file', { requestId, tempPath })

        // Transcribe with Groq
        const groq = getGroqClient()
        const transcription = await groq.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-large-v3',
          response_format: 'text',
        })

        queryText = typeof transcription === 'string' ? transcription : String(transcription)

        // Cleanup
        await fs.promises.unlink(tempPath).catch(() => {})

        logger.info('[VoiceInput] Transcribed', { requestId, text: queryText.substring(0, 50) })
      } catch (transcribeError: any) {
        logger.error('[VoiceInput] Transcription failed', { requestId, error: transcribeError?.message })
        return {
          status: 400,
          body: {
            error: 'Failed to transcribe audio',
            details: transcribeError?.message,
            requestId,
          },
        }
      }
    }

    // Validate we have text
    if (!queryText || queryText.trim() === '') {
      return {
        status: 400,
        body: {
          error: 'Either text or audioBase64 is required',
          requestId,
        },
      }
    }

    logger.info('[VoiceInput] Processing query', { requestId, text: queryText.substring(0, 50) })

    // Save to state
    await state.set('responses', requestId, {
      status: 'processing',
      requestId,
      query: queryText,
      enableVoiceResponse,
      isVoiceRequest: true,
      createdAt: new Date().toISOString(),
    })

    // Route to agents
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
  } catch (error: any) {
    console.error('[VoiceInput] Handler error:', error)
    return {
      status: 500,
      body: {
        error: 'Voice processing failed',
        message: error?.message || 'Unknown error',
        requestId,
      },
    }
  }
}
