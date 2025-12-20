# 🤖 AI-Powered Customer Support Agent System

An intelligent, multi-agent customer support system built with **Motia Framework**, **Google Gemini AI**, **Groq Voice AI**, and **MongoDB**. This system automatically routes customer queries to specialized agents and provides both text and voice responses.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Flow Diagrams](#flow-diagrams)
- [Step-by-Step Flow Explanation](#step-by-step-flow-explanation)
- [Usage Examples](#usage-examples)
- [Voice Integration](#voice-integration)
- [Root Cause Analysis (RCA)](#root-cause-analysis-rca)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)
- [Contributing](#contributing)

---

## 🎯 Overview

This project implements an **AI-powered customer support system** that:

1. **Receives customer queries** via REST API (text or voice)
2. **Analyzes and routes** queries to specialized agents using Google Gemini AI
3. **Retrieves customer data** from MongoDB for personalized responses
4. **Generates intelligent responses** tailored to the customer's specific situation
5. **Converts responses to speech** using Groq's PlayAI TTS (optional)

### Key Capabilities

| Feature | Description |
|---------|-------------|
| 🧠 **Intelligent Routing** | AI determines which agent handles each query |
| 📦 **Shipping Support** | Agent Havoc handles delivery delays, tracking issues |
| 💳 **Payment Support** | Agent Hulk handles payment failures, billing |
| 💰 **Refund Processing** | Refund Agent processes approved refunds |
| 🛡️ **Fraud Detection** | Fraud Detector validates refund requests before processing |
| 🎙️ **Voice Communication** | Agent Aisha transforms responses into empathetic voice communications |
| 🚨 **SRE Monitoring** | Agent Sentinel monitors system health and alerts developers |
| 🎤 **Voice Input** | Speech-to-text transcription via Groq Whisper |
| 🔊 **Voice Output** | Text-to-speech responses via Groq PlayAI |
| 🗄️ **Customer Data** | Personalized responses based on order history |
| 📊 **Root Cause Analysis** | Automated failure analysis with AI-powered summaries |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Frontend)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ POST        │ │ POST        │ │ GET         │
            │ /api/order  │ │ /api/voice  │ │ /api/.../   │
            │ /query      │ │ /query      │ │ response    │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    ▼               ▼               │
            ┌─────────────┐ ┌─────────────┐         │
            │ Analyze     │ │ Voice_input │         │
            │ .step.ts    │ │ .step.ts    │         │
            └─────────────┘ └─────────────┘         │
                    │               │               │
                    │    ┌──────────┘               │
                    ▼    ▼                          │
            ┌─────────────────────┐                 │
            │   Agents.step.ts    │                 │
            │   (AI Routing)      │                 │
            │   Google Gemini     │                 │
            └─────────────────────┘                 │
                    │                               │
         ┌──────────┴──────────┐                   │
         ▼                     ▼                   │
┌─────────────────┐   ┌─────────────────┐          │
│ Agent_havoc     │   │ Agents_hulk     │          │
│ .step.ts        │   │ .step.ts        │          │
│ (Shipping)      │   │ (Payments)      │          │
└─────────────────┘   └─────────────────┘          │
         │                     │                   │
         │    ┌────────────────┘                   │
         ▼    ▼                                    │
┌─────────────────────┐                            │
│   MongoDB           │                            │
│   Customer Data     │                            │
└─────────────────────┘                            │
         │                                         │
         ▼                                         │
┌─────────────────────┐                            │
│ Response Handlers   │                            │
│ Havoc_response.ts   │                            │
│ Hulk_response.ts    │                            │
└─────────────────────┘                            │
         │                                         │
         ├─────────────────────────────────────────┘
         │
         ▼ (if voice enabled)
┌─────────────────────┐
│ Voice_output.step   │
│ (Groq TTS)          │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   Audio File        │
│   /public/audio/    │
└─────────────────────┘
```

---

## 🤖 Agent Event Flow

The system uses event-driven architecture where agents communicate via topic subscriptions:

```
                              ┌─────────────────────────────────────┐
                              │         API Entry Points            │
                              │  (Analyze, Voice_input, Query)      │
                              └─────────────────┬───────────────────┘
                                               │
                                  emit: google.analyzequeryRequest
                                               │
                              ┌────────────────▼────────────────────┐
                              │          Agents.step.ts             │
                              │       (AI Query Router)             │
                              └───┬─────────────┬──────────────┬────┘
                                  │             │              │
        google.havocRequest ◄─────┘             │              └─────► google.fraud_detectorRequest
                │                               │                              │
                ▼                               │                              ▼
    ┌───────────────────────┐                  │                  ┌───────────────────────┐
    │   Agent_Havoc.step    │          google.hulkRequest         │  Fraud_detector.step  │
    │   (Shipping Agent)    │                  │                  │  (Fraud Detection)    │
    └───────────┬───────────┘                  │                  └───────────┬───────────┘
                │                              ▼                              │
        havoc.response              ┌───────────────────────┐        google.refund.requested
                │                   │   Agent_Hulk.step     │                 │
                │                   │   (Payment Agent)     │                 ▼
                │                   └───────────┬───────────┘      ┌───────────────────────┐
                │                               │                  │   Refund_agent.step   │
                │                        hulk.response             │  (Refund Processing)  │
                │                               │                  └───────────┬───────────┘
                │                               │                              │
                │                               │                    refund.response / fraud.response
                │                               │                              │
                └───────────────────────────────┼──────────────────────────────┘
                                               │
                              ┌────────────────▼────────────────────┐
                              │        agent-aisha.step.ts          │
                              │   (Voice Communication Layer)       │
                              │  Subscribes to: havoc.response,     │
                              │  hulk.response, refund.response,    │
                              │  fraud.response                     │
                              └─────────────────┬───────────────────┘
                                               │
                                      voice.synthesize
                                               │
                              ┌────────────────▼────────────────────┐
                              │       Voice_output.step.ts          │
                              │         (TTS Synthesis)             │
                              └─────────────────────────────────────┘
```

### SRE Monitoring Flow

```
   System Health Events                        ┌─────────────────────────┐
  (system.health.down, etc.)  ─────────────►   │  agent-sentinel.step    │
                                               │  (SRE Monitoring)       │
                                               └───────────┬─────────────┘
                                                           │
                                                    dev.alert.sent
                                                           │
                                               ┌───────────▼─────────────┐
                                               │ dev-alert-handler.step  │
                                               │ (Log & Store Alerts)    │
                                               └─────────────────────────┘
```

---

## ✨ Features

### 🎯 Intelligent Query Routing

The system uses **Google Gemini AI** to analyze customer queries and route them to the appropriate specialist agent:

- **Agent Havoc** 📦: Shipping delays, tracking issues, delivery problems
- **Agent Hulk** 💳: Payment failures, billing inquiries (NOT refunds)
- **Fraud Detector** 🛡️: Validates refund requests for fraud before processing
- **Refund Agent** 💰: Processes approved refund requests

If AI is unavailable (quota exceeded), a **keyword-based fallback** ensures queries still get routed correctly.

### 🎙️ Agent Aisha - Voice Communication Layer

**Agent Aisha** acts as the customer-facing communication layer:
- Transforms technical internal responses into empathetic, voice-friendly messages
- Listens to all agent responses (`havoc.response`, `hulk.response`, `refund.response`, `fraud.response`)
- Triggers voice synthesis for audio output
- Uses AI to create warm, conversational responses

### 🚨 Agent Sentinel - SRE/DevOps Monitoring

**Agent Sentinel** monitors system health and alerts developers:
- Monitors health events (`system.health.down`, `system.health.degraded`, etc.)
- Determines severity using configurable policies
- Notifies developers via configurable channels (Slack, Email, PagerDuty)
- Generates AI-written incident summaries
- NEVER notifies customers directly

### 🗣️ Voice Integration

- **Speech-to-Text (STT)**: Groq Whisper Large V3 transcribes audio input
- **Text-to-Speech (TTS)**: Groq PlayAI converts responses to natural speech
- Audio files saved as WAV format for universal compatibility

### 📊 Customer Data Lookup

Agents retrieve customer information from MongoDB using multiple identifiers:
- Email address
- Customer ID
- Order ID
- Tracking number
- Phone number
- Name (fuzzy search)

### ⚡ Async Processing with State Management

- Queries processed asynchronously for better scalability
- **Request ID** returned immediately for tracking
- Responses stored in **Motia State** for retrieval
- Frontend can poll for completion status

### 🛡️ Robust Error Handling

- AI fallback to keyword-based routing
- Templated responses when AI unavailable
- Graceful degradation if database unreachable

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Motia Framework** | Workflow orchestration, event-driven architecture |
| **TypeScript** | Type-safe development |
| **Google Gemini AI** | Query analysis and response generation |
| **Groq AI** | Voice STT (Whisper) and TTS (PlayAI) |
| **MongoDB** | Customer and order data storage |
| **Redis** | State management and caching (via Motia) |
| **Zod** | Runtime schema validation |
| **Docker** | Redis containerization |

---

## 📁 Project Structure

```
hackathon_project/
├── src/
│   ├── steps/                        # Motia workflow steps
│   │   │
│   │   │ # === API ENTRY POINTS ===
│   │   ├── Analyze.step.ts           # API: Entry point for text queries
│   │   ├── Voice_input.step.ts       # API: Entry point for voice queries
│   │   ├── GetResponse.step.ts       # API: Retrieve text response
│   │   ├── GetVoiceResponse.step.ts  # API: Retrieve voice response
│   │   │
│   │   │ # === CUSTOMER SUPPORT AGENTS ===
│   │   ├── Agents.step.ts            # Event: AI-powered query routing
│   │   ├── Agent_Havoc.step.ts       # Event: Shipping & delivery support
│   │   ├── Agent_Hulk.step.ts        # Event: Payment & billing support
│   │   ├── Fraud_detector.step.ts    # Event: Fraud detection for refunds
│   │   ├── Refund_agent.step.ts      # Event: Process approved refunds
│   │   ├── agent-aisha.step.ts       # Event: Voice communication layer
│   │   │
│   │   │ # === SRE/MONITORING AGENTS ===
│   │   ├── agent-sentinel.step.ts    # Event: System health monitoring
│   │   ├── dev-alert-handler.step.ts # Event: Developer alert handler
│   │   ├── System_health_api.step.ts # API: System health endpoints
│   │   ├── System_health_status.step.ts # Event: Health status processor
│   │   │
│   │   │ # === VOICE PROCESSING ===
│   │   ├── Voice_output.step.ts      # Event: TTS synthesis
│   │   │
│   │   │ # === RCA (ROOT CAUSE ANALYSIS) ===
│   │   ├── rca-analysis.step.ts      # Cron: Hourly RCA analysis
│   │   ├── rca-api.step.ts           # API: GET /api/rca/report
│   │   ├── rca-stats.step.ts         # API: GET /api/rca/stats
│   │   └── rca-report-handler.step.ts # Event: RCA report handler
│   │
│   ├── lib/
│   │   ├── db.ts                     # MongoDB connection utility
│   │   ├── gemini.ts                 # Google Gemini AI utilities
│   │   ├── failureStore.ts           # In-memory failure event storage
│   │   ├── failureLogger.ts          # Failure logging module
│   │   └── rcaEngine.ts              # RCA engine with aggregation + AI
│   │
│   └── models/
│       ├── Customer.ts               # Mongoose schema for customers
│       ├── Payment.ts                # Mongoose schema for payments
│       └── SystemHealth.ts           # Mongoose schema for health events
│
├── public/
│   └── audio/                        # Generated audio files (TTS output)
├── .env                              # Environment variables (not committed)
├── motia.config.ts                   # Motia framework configuration
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript configuration
└── README.md                         # This file
```

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** v18+ 
- **Docker** (for Redis)
- **MongoDB** (local or Atlas)
- **API Keys**: Google Gemini, Groq (optional for voice)

### Step 1: Clone and Install

```bash
cd hackathon_project
npm install
```

### Step 2: Start Redis (Docker)

```bash
docker run -d --name redis -p 6379:6379 redis
```

### Step 3: Configure Environment

Create a `.env` file:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=mongodb://localhost:27017/hackathon_db

# Required for Motia
REDIS_URL=redis://localhost:6379

# Optional (for voice features)
GROQ_API_KEY=your_groq_api_key_here
```

### Step 4: Start Development Server

```bash
npm run dev
```

The server starts on **http://localhost:3000**

### Step 5: Open Workbench (Optional)

Visit http://localhost:3000 to see the Motia Workbench with visual flow representation.

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API key for AI routing and responses |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `REDIS_URL` | ✅ | Redis URL for Motia state management |
| `GROQ_API_KEY` | ❌ | Groq API key (only needed for voice features) |

### Getting API Keys

- **Gemini**: https://makersuite.google.com/app/apikey
- **Groq**: https://console.groq.com/keys

---

## 📡 API Endpoints

### Text Query Endpoints

#### `POST /api/order/query`
Submit a text-based customer support query.

**Request:**
```json
{
  "text": "Where is my package? It's been delayed for 3 days!",
  "userInfo": {
    "email": "customer@example.com",
    "orderId": "ORD-12345"
  }
}
```

**Response:**
```json
{
  "status": "Accepted",
  "message": "Your query is being processed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### `GET /api/order/response/:requestId`
Retrieve the response for a submitted query.

**Response (processing):**
```json
{
  "status": "processing",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (completed):**
```json
{
  "status": "completed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "agent": "havoc",
  "response": "I understand your frustration about the delivery delay...",
  "query": "Where is my package?",
  "customerData": {
    "customerId": "CUST-001",
    "name": "John Doe",
    "ordersCount": 5
  },
  "completedAt": "2024-12-17T10:30:00.000Z"
}
```

---

### Voice Query Endpoints

#### `POST /api/voice/query`
Submit a voice or text query with optional voice response.

**Request (text with voice response):**
```json
{
  "text": "Why is my payment failing?",
  "userInfo": { "email": "customer@example.com" },
  "enableVoiceResponse": true
}
```

**Request (audio input):**
```json
{
  "audioBase64": "UklGRi4AAABXQVZFZm10...",
  "enableVoiceResponse": true
}
```

**Response:**
```json
{
  "status": "Accepted",
  "message": "Your voice query is being processed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "transcribedText": "Why is my payment failing?",
  "enableVoiceResponse": true
}
```

#### `GET /api/voice/response/:requestId`
Retrieve voice response with audio URL.

**Response:**
```json
{
  "status": "completed",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "response": "I see there was an issue with your payment...",
  "audioUrl": "/audio/response_550e8400-e29b-41d4-a716-446655440000.wav",
  "audioReady": true,
  "audioGeneratedAt": "2024-12-17T10:30:05.000Z"
}
```

---

## 🔄 Flow Diagrams

### Text Query Flow

```
POST /api/order/query
        │
        ▼
┌───────────────────┐
│ Analyze.step.ts   │ ──► Returns requestId immediately
│ (API Entry Point) │
└───────────────────┘
        │
        │ emit: google.analyzequeryRequest
        ▼
┌───────────────────┐
│ Agents.step.ts    │ ──► Google Gemini analyzes query
│ (AI Router)       │     Determines: "havoc" or "hulk"
└───────────────────┘
        │
   ┌────┴────┐
   ▼         ▼
havoc      hulk
   │         │
   ▼         ▼
┌────────┐ ┌────────┐
│ Agent  │ │ Agent  │ ──► Query MongoDB for customer data
│ Havoc  │ │ Hulk   │     Generate AI response
└────────┘ └────────┘
   │         │
   ▼         ▼
┌────────────────────┐
│ Response Handler   │ ──► Store response in state
│ (Havoc/Hulk)       │     Log completion
└────────────────────┘
        │
        ▼
GET /api/order/response/:requestId ──► Frontend retrieves response
```

### Voice Query Flow

```
POST /api/voice/query (with audioBase64)
        │
        ▼
┌────────────────────┐
│ Voice_input.step   │ ──► Groq Whisper transcribes audio
│ (API Entry Point)  │     Returns requestId + transcribedText
└────────────────────┘
        │
        │ emit: google.analyzequeryRequest
        ▼
     [Same flow as text query]
        │
        ▼
┌────────────────────┐
│ Response Handler   │ ──► Checks enableVoiceResponse flag
│ (Havoc/Hulk)       │
└────────────────────┘
        │
        │ emit: voice.synthesize (if enabled)
        ▼
┌────────────────────┐
│ Voice_output.step  │ ──► Groq PlayAI generates speech
│ (TTS Synthesis)    │     Saves WAV to /public/audio/
└────────────────────┘
        │
        ▼
GET /api/voice/response/:requestId ──► Returns audioUrl when ready
```

---

## 📖 Step-by-Step Flow Explanation

### 1. Query Submission (`Analyze.step.ts` or `Voice_input.step.ts`)

When a customer submits a query:
1. Generate unique `requestId` (UUID)
2. Initialize state with `status: 'processing'`
3. Emit event to routing step
4. Return `requestId` to client immediately

### 2. Intelligent Routing (`Agents.step.ts`)

The routing step:
1. Sends query to Google Gemini with system prompt
2. AI responds with agent name: `"havoc"` or `"hulk"`
3. If AI fails (quota, network), falls back to keyword matching
4. Emits to appropriate agent's topic

**System Prompt:**
```
You are a helpful assistant. You have two agents:
- Agent 1: havoc - shipping delays, tracking, delivery issues
- Agent 2: hulk - payment failures, refunds, billing

Respond with only one word: "havoc" or "hulk"
```

### 3. Agent Processing (`Agent_havoc.step.ts` / `Agents_hulk.step.ts`)

Each agent:
1. Queries MongoDB for customer data using `userInfo` identifiers
2. Formats customer data (orders, issues, history)
3. Sends to Gemini with agent-specific system prompt
4. Stores response in state
5. Emits to response handler

### 4. Response Handling (`Havoc_response.step.ts` / `Hulk_response.step.ts`)

Response handlers:
1. Log the completed response
2. Check if `enableVoiceResponse` is true
3. If yes, emit to `voice.synthesize` topic

### 5. Voice Synthesis (`Voice_output.step.ts`)

If voice is enabled:
1. Receive text response
2. Call Groq PlayAI TTS API
3. Save WAV file to `/public/audio/`
4. Update state with `audioUrl` and `audioReady: true`

### 6. Response Retrieval (`GetResponse.step.ts` / `GetVoiceResponse.step.ts`)

Client polls for response:
1. Read from state using `requestId`
2. Return current status and data
3. Include `audioUrl` when voice is ready

---

## 💻 Usage Examples

### cURL Examples

**Text Query:**
```bash
curl -X POST http://localhost:3000/api/order/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "My package has been delayed for 5 days, order ID ORD-12345",
    "userInfo": {
      "email": "john@example.com",
      "orderId": "ORD-12345"
    }
  }'
```

**Voice Query (with text):**
```bash
curl -X POST http://localhost:3000/api/voice/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Why did my payment fail?",
    "enableVoiceResponse": true,
    "userInfo": { "email": "john@example.com" }
  }'
```

**Get Response:**
```bash
curl http://localhost:3000/api/order/response/YOUR_REQUEST_ID
```

### JavaScript Frontend Example

```javascript
async function askCustomerSupport(question, email) {
  // Submit query
  const submitRes = await fetch('/api/voice/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: question,
      userInfo: { email },
      enableVoiceResponse: true
    })
  });
  
  const { requestId } = await submitRes.json();
  
  // Poll for response
  let response;
  while (true) {
    const res = await fetch(`/api/voice/response/${requestId}`);
    response = await res.json();
    
    if (response.status === 'completed' && response.audioReady) {
      break;
    }
    await new Promise(r => setTimeout(r, 1000)); // Wait 1 second
  }
  
  // Play audio response
  const audio = new Audio(response.audioUrl);
  audio.play();
  
  return response.response; // Text response
}

// Usage
askCustomerSupport("Where is my package?", "user@example.com");
```

---

## 🎤 Voice Integration

### Speech-to-Text (STT)

Uses **Groq Whisper Large V3** for transcription:
- Supports WAV audio format
- Send as Base64-encoded string
- Fast and accurate transcription

### Text-to-Speech (TTS)

Uses **Groq PlayAI** for speech synthesis:
- Natural-sounding voice (Fritz-PlayAI)
- WAV output format
- Files saved to `/public/audio/`

### Audio File Storage

Generated audio files are stored in:
```
/public/audio/response_{requestId}.wav
```

Access via: `http://localhost:3000/audio/response_{requestId}.wav`

---

## 📊 Root Cause Analysis (RCA)

The system includes a **lightweight RCA layer** that converts the reactive multi-agent system into a **learning system**. It automatically tracks failures, aggregates statistics, and uses AI to generate human-readable insights.

### 🎯 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **No new agents** | Only added modules, cron step, and API endpoints |
| **No fancy UI** | Text/JSON output only |
| **No ML models** | Rule-based aggregation logic |
| **AI only summarizes** | AI receives stats, produces 1-2 line natural language summary |
| **Decisions remain rule-based** | All counts/percentages calculated by deterministic code |

### 📁 RCA Module Structure

```
src/
├── lib/
│   ├── failureStore.ts      # In-memory storage for failure_events
│   ├── failureLogger.ts     # Failure logging module
│   └── rcaEngine.ts         # RCA engine with aggregation + AI summary
└── steps/
    ├── rca-analysis.step.ts # Cron: Hourly RCA analysis
    ├── rca-api.step.ts      # API: GET /api/rca/report
    └── rca-stats.step.ts    # API: GET /api/rca/stats
```

### 📝 Failure Logging

Failures are automatically logged from all agents with the following schema:

```typescript
interface FailureEvent {
  id: string
  failure_type: 'payment' | 'fraud' | 'shipping'
  agent_name: string
  gateway?: string           // e.g., 'stripe', 'fedex', 'refund_validation'
  timestamp: Date
  request_id: string
  correlation_id?: string    // e.g., orderId
  error_message?: string
  metadata?: Record<string, any>
}
```

**Usage in agents:**

```typescript
import { logPaymentFailure, logShippingFailure, logFraudFailure } from '../lib/failureLogger'

// Log a payment failure
logPaymentFailure({
  agent_name: 'hulk',
  request_id: requestId,
  gateway: 'stripe',
  error_message: 'Card declined',
})

// Log a shipping failure
logShippingFailure({
  agent_name: 'havoc',
  request_id: requestId,
  gateway: 'fedex',
  error_message: 'Delivery delayed - weather',
  correlation_id: orderId,
})
```

### 📈 Aggregation Logic

The RCA engine provides the following aggregation functions:

| Function | Description |
|----------|-------------|
| `aggregateBy('failure_type')` | Group failures by type (payment/fraud/shipping) |
| `aggregateBy('agent_name')` | Group failures by agent (hulk/havoc/fraud_detector) |
| `aggregateBy('gateway')` | Group failures by gateway/carrier |
| `getFailuresByHour()` | Distribution of failures by hour (0-23) |
| `getPeakFailureHours(3)` | Top 3 hours with most failures |
| `getRepeatedPatterns()` | Identify recurring failure patterns |

**Example aggregation output:**

```json
{
  "by_type": [
    { "key": "payment", "count": 15, "percentage": 45 },
    { "key": "shipping", "count": 10, "percentage": 30 },
    { "key": "fraud", "count": 8, "percentage": 25 }
  ],
  "by_gateway": [
    { "key": "stripe", "count": 12, "percentage": 80 },
    { "key": "fedex", "count": 5, "percentage": 50 }
  ],
  "peak_hours": [
    { "hour": 18, "count": 15, "percentage": 35 },
    { "hour": 19, "count": 12, "percentage": 28 }
  ]
}
```

### 🤖 AI Summarization

The RCA engine sends **only aggregated statistics** to the LLM, which generates a **1-2 line natural language summary**.

**Important:** AI does NOT make decisions. It only explains what the data shows.

**Example AI Summary:**
```
"80% of payment failures occurred on Stripe gateway between 6-8 PM. 
Shipping delays were primarily from FedEx due to weather conditions."
```

### 📡 RCA API Endpoints

#### `GET /api/rca/report`

Get full RCA analysis with AI-generated summary.

**Query Parameters:**
- `hours` - Number of hours to look back (default: 24)
- `format` - Output format: `json` or `text` (default: json)

**Example Request:**
```bash
curl "http://localhost:3000/api/rca/report?hours=24&format=json"
```

**Example Response:**
```json
{
  "success": true,
  "report": {
    "generated_at": "2024-12-18T10:00:00.000Z",
    "time_window": {
      "from": "2024-12-17T10:00:00.000Z",
      "to": "2024-12-18T10:00:00.000Z",
      "hours": 24
    },
    "summary": {
      "total_failures": 33,
      "by_type": [
        { "key": "payment", "count": 15, "percentage": 45 }
      ],
      "by_agent": [
        { "key": "hulk", "count": 15, "percentage": 45 }
      ],
      "by_gateway": [
        { "key": "stripe", "count": 12, "percentage": 80 }
      ]
    },
    "time_analysis": {
      "peak_hours": [
        { "hour": 18, "count": 15, "percentage": 35 }
      ]
    },
    "patterns": {
      "repeated_failures": [
        { "pattern": "hulk:stripe:Card declined", "count": 10 }
      ]
    },
    "insights": {
      "most_failing_gateway": { "name": "stripe", "percentage": 80, "count": 12 },
      "peak_failure_window": { "hours": "6 PM-8 PM", "percentage": 63 }
    },
    "ai_summary": "80% of payment failures occurred on Stripe between 6-8 PM."
  }
}
```

#### `GET /api/rca/stats`

Get quick statistics without AI call (faster endpoint).

**Query Parameters:**
- `hours` - Number of hours to look back (default: 24)

**Example Request:**
```bash
curl "http://localhost:3000/api/rca/stats?hours=24"
```

**Example Response:**
```json
{
  "success": true,
  "time_window_hours": 24,
  "stats": {
    "total_failures": 33,
    "top_failure_type": { "type": "payment", "count": 15, "percentage": 45 },
    "top_gateway": { "name": "stripe", "count": 12, "percentage": 80 },
    "top_agent": { "name": "hulk", "count": 15, "percentage": 45 },
    "store": {
      "total_events": 33,
      "oldest_event": "2024-12-17T10:00:00.000Z",
      "newest_event": "2024-12-18T09:55:00.000Z"
    }
  }
}
```

### ⏰ Automated Analysis (Cron)

The `RCAAnalysisCron` step runs **every hour** and:

1. Analyzes the last 24 hours of failure events
2. Generates structured insights (counts, percentages)
3. Calls AI for a natural language summary
4. Stores the report in Motia state
5. Emits `rca.report.generated` event

**Cron Schedule:** `0 * * * *` (every hour at minute 0)

### 📋 Example RCA Report (Text Format)

```
═══════════════════════════════════════════════════════════
                    RCA ANALYSIS REPORT                     
═══════════════════════════════════════════════════════════

Generated: 2024-12-18T10:00:00.000Z
Window: 24 hours

📊 SUMMARY
   Total Failures: 33

   By Type:
     • payment: 15 (45%)
     • shipping: 10 (30%)
     • fraud: 8 (25%)

   By Agent:
     • hulk: 15 (45%)
     • havoc: 10 (30%)
     • fraud_detector: 8 (25%)

   By Gateway:
     • stripe: 12 (80%)
     • fedex: 5 (50%)
     • refund_validation: 8 (100%)

⏰ PEAK FAILURE HOURS
     • 6 PM: 15 failures (35%)
     • 7 PM: 12 failures (28%)
     • 8 PM: 6 failures (14%)

🔄 REPEATED PATTERNS
     • hulk + stripe: 12x
     • havoc + fedex: 5x
     • fraud_detector + refund_validation: 8x

🤖 AI SUMMARY
   "80% of payment failures occurred on Stripe gateway between 6-8 PM.
    Shipping delays were primarily from FedEx due to weather conditions."

═══════════════════════════════════════════════════════════
```

### 🔧 Integration with Existing Agents

Failure logging is automatically integrated into the existing agents:

| Agent | Failure Type | What's Logged |
|-------|--------------|---------------|
| **Agent Havoc** | `shipping` | Delayed orders, carrier issues, agent errors |
| **Agent Hulk** | `payment` | Payment failures, transaction errors |
| **Fraud Detector** | `fraud` | Blocked refunds, high risk scores, system errors |

---

## 🗄️ Database Schema

### Customer Collection

```typescript
interface ICustomer {
  customerId: string;        // Unique customer ID
  name: string;              // Customer name
  email: string;             // Email (unique, lowercase)
  phone?: string;            // Phone number
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  orders: IOrder[];          // Array of orders
  createdAt: Date;
  updatedAt: Date;
}

interface IOrder {
  orderId: string;           // Unique order ID
  productName: string;
  quantity: number;
  price: number;
  orderDate: Date;
  shipmentStatus: ShipmentStatus;
  trackingNumber?: string;
  carrier?: string;
  estimatedDelivery?: Date;
  issue?: IIssue;
}

interface IIssue {
  type: IssueType;           // payment_failed, weather_delay, etc.
  description?: string;
  reportedDate?: Date;
  resolvedDate?: Date;
  isResolved: boolean;
}

type ShipmentStatus = 
  | 'pending' | 'processing' | 'shipped' | 'in_transit'
  | 'out_for_delivery' | 'delivered' | 'delayed' 
  | 'cancelled' | 'returned';

type IssueType = 
  | 'payment_failed' | 'weather_delay' | 'customs_hold'
  | 'address_issue' | 'out_of_stock' | 'carrier_delay'
  | 'damaged_in_transit' | 'returned_to_sender' | 'none';
```

---

## 🛡️ Error Handling

### AI Quota Exceeded

When Gemini API quota is exceeded:
1. `Agents.step.ts` falls back to keyword-based routing
2. Agent steps use templated responses instead of AI

### Database Unavailable

If MongoDB is unreachable:
1. Agents respond with generic helpful messages
2. Suggest customer contact support directly

### Voice API Failures

If Groq API fails:
1. Text response still available
2. `audioError` field contains error message
3. `audioReady` remains `false`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project was created for a hackathon. Feel free to use and modify!

---

## 🙏 Acknowledgments

- **Motia Framework** - Workflow orchestration
- **Google Gemini** - AI capabilities
- **Groq** - Voice AI (Whisper + PlayAI)
- **MongoDB** - Database

---

**Built with ❤️ for better customer support experiences**
