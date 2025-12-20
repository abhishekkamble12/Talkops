import { ApiRouteConfig, ApiRouteHandler, ApiResponse } from 'motia'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import Groq from 'groq-sdk'
import fs from 'fs'

// =============================================================================
// GROQ CLIENT
// =============================================================================

let groqClient: Groq | null = null

function getGroqClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groqClient
}

// =============================================================================
// TRANSCRIBE AUDIO FROM FILE
// =============================================================================

async function transcribeFromFile(filePath: string): Promise<string> {
  const groq = getGroqClient()
  if (!groq) throw new Error('GROQ_API_KEY not set')

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
      response_format: 'text',
    })

    return typeof transcription === 'string' 
      ? transcription.trim() 
      : (transcription as any).text?.trim() || ''

  } finally {
    // Cleanup temp file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// =============================================================================
// SCHEMAS
// =============================================================================

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
  audio_file_path: z.string().optional(), // File path from middleware
  audio_format: z.string().optional(),
  userInfo: userInfoSchema.optional(),
  enableVoiceResponse: z.boolean().optional(),
})

type BodyType = z.infer<typeof bodySchema>
type UserInfo = z.infer<typeof userInfoSchema>

type EmitData = {
  topic: 'google.analyzequeryRequest'
  data: { text: string; userInfo?: UserInfo; requestId: string; enableVoiceResponse: boolean }
}

// =============================================================================
// CONFIG
// =============================================================================

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'voiceInput',
  description: 'Voice/text input. Audio saved by middleware, transcribed here.',
  path: '/api/voice/query',
  method: 'POST',
  emits: ['google.analyzequeryRequest'],
  bodySchema: bodySchema as any,
  flows: ['customer-support'],
}

// =============================================================================
// HANDLER
// =============================================================================

export const handler: ApiRouteHandler<BodyType, ApiResponse, EmitData> = async (req, { emit, logger, state }) => {
  const requestId = randomUUID()

  try {
    const body = req.body || {}
    const text = body.text
    const audioFilePath = body.audio_file_path
    const userInfo = body.userInfo
    const enableVoiceResponse = body.enableVoiceResponse !== false

    logger.info('[VoiceInput] Request received', {
      requestId,
      hasText: !!text,
      hasAudioFile: !!audioFilePath,
    })

    let queryText = text || ''

    // Transcribe audio if file path provided
    if (audioFilePath && !text) {
      if (!process.env.GROQ_API_KEY) {
        return {
          status: 400,
          body: { error: 'Voice not available', message: 'GROQ_API_KEY required', requestId },
        }
      }

      if (!fs.existsSync(audioFilePath)) {
        return {
          status: 400,
          body: { error: 'Audio file not found', requestId },
        }
      }

      try {
        logger.info('[VoiceInput] Transcribing audio file...', { requestId, path: audioFilePath })
        queryText = await transcribeFromFile(audioFilePath)
        logger.info('[VoiceInput] Transcription complete', { requestId, text: queryText.substring(0, 50) })
      } catch (err: any) {
        logger.error('[VoiceInput] Transcription failed', { requestId, error: err?.message })
        return {
          status: 400,
          body: { error: 'Transcription failed', message: err?.message, requestId },
        }
      }
    }

    // Validate
    if (!queryText?.trim()) {
      return {
        status: 400,
        body: { error: 'No text or audio provided', requestId },
      }
    }

    // Save state
    const finalEnableVoice = enableVoiceResponse && !!process.env.GROQ_API_KEY

    await state.set('responses', requestId, {
      status: 'processing',
      requestId,
      query: queryText,
      enableVoiceResponse: finalEnableVoice,
      isVoiceRequest: !!audioFilePath,
      createdAt: new Date().toISOString(),
    })

    // Route to agents
    await emit({
      topic: 'google.analyzequeryRequest',
      data: {
        text: queryText,
        userInfo,
        requestId,
        enableVoiceResponse: finalEnableVoice,
      },
    })

    return {
      status: 200,
      body: {
        status: 'Accepted',
        message: 'Processing',
        requestId,
        transcribedText: queryText,
        enableVoiceResponse: finalEnableVoice,
      },
    }

  } catch (error: any) {
    logger.error('[VoiceInput] Handler error', { requestId, error: error?.message })
    return {
      status: 500,
      body: { error: 'Failed', message: error?.message, requestId },
    }
  }
}
