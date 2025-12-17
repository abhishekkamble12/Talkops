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
| 💳 **Payment Support** | Agent Hulk handles payment failures, refunds, billing |
| 🎤 **Voice Input** | Speech-to-text transcription via Groq Whisper |
| 🔊 **Voice Output** | Text-to-speech responses via Groq PlayAI |
| 🗄️ **Customer Data** | Personalized responses based on order history |

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

## ✨ Features

### 🎯 Intelligent Query Routing

The system uses **Google Gemini AI** to analyze customer queries and route them to the appropriate specialist agent:

- **Agent Havoc** 📦: Shipping delays, tracking issues, delivery problems
- **Agent Hulk** 💳: Payment failures, refunds, billing inquiries

If AI is unavailable (quota exceeded), a **keyword-based fallback** ensures queries still get routed correctly.

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
│   ├── steps/                    # Motia workflow steps
│   │   ├── Analyze.step.ts       # API: Entry point for text queries
│   │   ├── Voice_input.step.ts   # API: Entry point for voice queries
│   │   ├── Agents.step.ts        # Event: AI-powered query routing
│   │   ├── Agent_havoc.step.ts   # Event: Shipping support agent
│   │   ├── Agents_hulk.step.ts   # Event: Payment support agent
│   │   ├── Havoc_response.step.ts# Event: Shipping response handler
│   │   ├── Hulk_response.step.ts # Event: Payment response handler
│   │   ├── Voice_output.step.ts  # Event: TTS synthesis
│   │   ├── GetResponse.step.ts   # API: Retrieve text response
│   │   └── GetVoiceResponse.step.ts # API: Retrieve voice response
│   ├── lib/
│   │   └── db.ts                 # MongoDB connection utility
│   └── models/
│       └── Customer.ts           # Mongoose schema for customers
├── public/
│   └── audio/                    # Generated audio files (TTS output)
├── .env                          # Environment variables (not committed)
├── motia.config.ts               # Motia framework configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
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
