import { config } from '@motiadev/core'
import endpointPlugin from '@motiadev/plugin-endpoint/plugin'
import logsPlugin from '@motiadev/plugin-logs/plugin'
import observabilityPlugin from '@motiadev/plugin-observability/plugin'
import statesPlugin from '@motiadev/plugin-states/plugin'
import bullmqPlugin from '@motiadev/plugin-bullmq/plugin'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import Groq from 'groq-sdk'
import express from 'express'
import { fileURLToPath } from 'url'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Groq client
let groqClient: Groq | null = null
function getGroq(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groqClient
}

export default config({
  redis: {
    useMemoryServer: false,
    host: '127.0.0.1',
    port: 6379,
  },
  plugins: [observabilityPlugin, statesPlugin, endpointPlugin, logsPlugin, bullmqPlugin],
  app: (app) => {
    // CORS
    app.use(cors({
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
      credentials: true
    }))

    // Serve audio files from public/audio directory
    const audioDir = path.join(process.cwd(), 'public', 'audio')
    fs.mkdirSync(audioDir, { recursive: true })
    app.use('/audio', express.static(audioDir))
    console.log('[Motia] Serving audio files from:', audioDir)

    // =========================================================================
    // CUSTOM VOICE ENDPOINT - Handles audio BEFORE Motia processes it
    // This completely bypasses Motia's spawn issue by handling voice directly
    // =========================================================================
    app.post('/api/voice/upload', express.json({ limit: '50mb' }), async (req: any, res: any) => {
      const requestId = randomUUID()
      
      try {
        const { audio_data, audio_format, text, userInfo, enableVoiceResponse } = req.body

        console.log(`[VoiceUpload] Request ${requestId}`, {
          hasAudio: !!audio_data,
          hasText: !!text,
          format: audio_format
        })

        let queryText = text || ''

        // Transcribe audio if provided
        if (audio_data && !text) {
          const groq = getGroq()
          if (!groq) {
            return res.status(400).json({
              error: 'Voice not available',
              message: 'GROQ_API_KEY required',
              requestId
            })
          }

          try {
            // Decode and save to temp file
            const audioBuffer = Buffer.from(audio_data, 'base64')
            const ext = audio_format || 'webm'
            const tempFile = path.join(os.tmpdir(), `voice_${requestId}.${ext}`)
            
            fs.writeFileSync(tempFile, audioBuffer)
            console.log(`[VoiceUpload] Saved audio to ${tempFile} (${audioBuffer.length} bytes)`)

            // Transcribe
            const transcription = await groq.audio.transcriptions.create({
              file: fs.createReadStream(tempFile),
              model: 'whisper-large-v3',
              response_format: 'text',
            })

            queryText = typeof transcription === 'string' 
              ? transcription.trim() 
              : (transcription as any).text?.trim() || ''

            console.log(`[VoiceUpload] Transcribed: "${queryText.substring(0, 50)}..."`)

            // Cleanup
            try { fs.unlinkSync(tempFile) } catch {}

          } catch (err: any) {
            console.error(`[VoiceUpload] Transcription failed:`, err?.message)
            return res.status(400).json({
              error: 'Transcription failed',
              message: err?.message,
              requestId
            })
          }
        }

        if (!queryText?.trim()) {
          return res.status(400).json({
            error: 'No text or audio',
            requestId
          })
        }

        // Forward to Motia's internal endpoint (text only, no audio)
        // This avoids the spawn issue since we only pass small text
        const axios = (await import('axios')).default
        const response = await axios.post('http://localhost:3000/api/voice/query', {
          text: queryText,
          userInfo,
          enableVoiceResponse,
          // No audio_data - already transcribed
        }, {
          headers: { 'Content-Type': 'application/json' }
        })

        return res.json({
          ...response.data,
          transcribedText: queryText,
        })

      } catch (error: any) {
        console.error(`[VoiceUpload] Error:`, error?.message)
        return res.status(500).json({
          error: 'Failed',
          message: error?.message,
          requestId
        })
      }
    })
  }
})
