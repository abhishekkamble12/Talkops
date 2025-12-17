import { EventConfig, EventHandler } from 'motia'
import { z } from 'zod'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'

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

const inputSchema = z.object({
  text: z.string(),
  requestId: z.string(),
})

type InputType = z.infer<typeof inputSchema>

export const config: EventConfig = {
  type: 'event',
  name: 'VoiceOutput',
  description: 'Converts text response to speech using Groq PlayAI TTS',
  subscribes: ['voice.synthesize'],
  emits: [],
  input: inputSchema as any,
  flows: ['customer-support'],
}

export const handler: EventHandler<InputType, never> = async (input, { logger, state }) => {
  const { text, requestId } = input

  logger.info('[VoiceOutput] Synthesizing speech', { 
    requestId, 
    textLength: text.length 
  })

  try {
    const groq = getGroqClient()
    
    // Generate speech using Groq TTS
    const response = await groq.audio.speech.create({
      model: 'playai-tts',
      voice: 'Fritz-PlayAI',
      input: text,
      response_format: 'wav',
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    
    // Save audio file to public directory
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    await fs.promises.mkdir(audioDir, { recursive: true })
    
    const audioFileName = `response_${requestId}.wav`
    const audioFilePath = path.join(audioDir, audioFileName)
    
    await fs.promises.writeFile(audioFilePath, buffer)

    // Update state with audio URL
    const currentState = await state.get<any>('responses', requestId)
    if (currentState) {
      await state.set('responses', requestId, {
        ...currentState,
        audioUrl: `/audio/${audioFileName}`,
        audioReady: true,
        audioGeneratedAt: new Date().toISOString(),
      })
    }

    logger.info('[VoiceOutput] Speech synthesized successfully', { 
      requestId, 
      audioUrl: `/audio/${audioFileName}`,
      audioSize: buffer.length,
    })
  } catch (error: any) {
    logger.error('[VoiceOutput] TTS synthesis failed', { 
      error: error?.message, 
      requestId 
    })

    // Update state with error
    const currentState = await state.get<any>('responses', requestId)
    if (currentState) {
      await state.set('responses', requestId, {
        ...currentState,
        audioError: error?.message || 'TTS synthesis failed',
        audioReady: false,
      })
    }
  }
}

