# 🤖 Unified Agentic Backend System

> A production-grade, event-driven backend with AI agents that reason, act autonomously, and communicate safely.

## 🎯 Overview

This system implements **four autonomous agents** that work together via events and policies:

| Agent | Role | Events |
|-------|------|--------|
| 🚚 **HAVOC** | Shipping Support | `agent.havoc.request` → `havoc.response` |
| 💳 **HULK** | Payment Support | `agent.hulk.request` → `hulk.response` |
| 🚨 **SENTINEL** | Site Reliability / DevOps | `system.health.*` → `dev.alert.sent` |
| 🎙 **AISHA** | Voice Customer Care | `*.response` → `voice.synthesize` |

## 📁 Project Structure

```
src/
├── agents/                    # Autonomous Agent Steps
│   ├── havoc.step.ts         # 🚚 Shipping Support Agent
│   ├── hulk.step.ts          # 💳 Payment Support Agent
│   ├── sentinel.step.ts      # 🚨 SRE/DevOps Agent
│   ├── aisha.step.ts         # 🎙 Voice Communication Agent
│   └── router.step.ts        # 🧭 Intelligent Query Router
│
├── api/                       # API Endpoints
│   ├── query.step.ts         # POST /api/support/query
│   ├── response.step.ts      # GET /api/support/response/:id
│   ├── health-event.step.ts  # POST /api/system/health-event
│   └── incidents.step.ts     # GET /api/system/incidents
│
├── lib/                       # Shared Utilities
│   ├── gemini.ts             # 🧠 Unified Gemini LLM Client
│   ├── db.ts                 # MongoDB Connection
│   └── failureLogger.ts      # RCA Failure Logging
│
├── models/                    # MongoDB Models
│   ├── Customer.ts           # Customer & Orders Schema
│   ├── Payment.ts            # Payment Transactions
│   └── SystemHealth.ts       # Health Events & Incidents
│
└── scripts/
    └── seed-data.ts          # Test Data Seeder
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
```env
# Required
GEMINI_API_KEY=your_gemini_api_key
MONGODB_URI=mongodb://localhost:27017/agentic-support

# Optional
GROQ_API_KEY=your_groq_api_key  # For voice transcription
```

### 3. Seed Test Data
```bash
npx ts-node src/scripts/seed-data.ts
```

### 4. Start the Server
```bash
npm run dev
```

### 5. Open Workbench
Navigate to `http://localhost:3000` to see the visual workflow.

---

## 🧠 Agent Architecture

### LLM Usage Rules (Critical)

All agents follow these strict LLM usage patterns:

1. **LLMs receive:**
   - User query
   - Structured `agentState` JSON (never raw data)

2. **LLMs must:**
   - Reason about missing vs available info
   - Decide next step based on state
   - Explain future action to user

3. **LLMs must NOT:**
   - Hallucinate system actions
   - Invent orders, amounts, or dates
   - Expose internal errors

---

## 🚚 Agent HAVOC (Shipping Support)

### Responsibilities
- Handle shipping and delivery queries
- Fetch customer + order data from MongoDB
- Detect delayed shipments, carrier issues
- Build structured `agentState` for LLM reasoning

### Agent State Structure
```typescript
interface HavocAgentState {
  customer_found: boolean
  known_fields: string[]
  missing_fields: string[]
  delayed_orders: DelayedOrder[]
  active_orders: ActiveOrder[]
  shipping_summary: {
    total_orders: number
    delivered_count: number
    in_transit_count: number
    delayed_count: number
  }
  action_capabilities: string[]
  recommended_action: string
}
```

### Example Flow
```
User: "Where is my order?"
       ↓
[Query Router] → agent.havoc.request
       ↓
[Agent Havoc] 
  1. Query MongoDB for customer
  2. Build agentState JSON
  3. Send to Gemini with system prompt
  4. Emit havoc.response
       ↓
[Agent Aisha] → Transforms to voice-friendly response
```

---

## 💳 Agent HULK (Payment Support)

### Responsibilities
- Handle payment failures, retries, billing issues
- Detect retry counts, gateway failures
- Determine refund eligibility from state
- Generate calm, reassuring responses

### Agent State Structure
```typescript
interface HulkAgentState {
  customer_found: boolean
  payment_found: boolean
  failure_reason: string | null
  retry_count: number
  refund_eligible: boolean  // ONLY promise refund if TRUE
  payment_issues: PaymentIssue[]
  billing_summary: {
    totalOrders: number
    totalSpent: number
    failedPayments: number
  }
  recommended_action: string
}
```

### Safety Rules
- **NEVER promise refunds** unless `refund_eligible === true`
- Always explain resolution steps clearly
- Never blame the customer

---

## 🚨 Agent SENTINEL (SRE/DevOps)

### Responsibilities
- Monitor system health events
- Apply severity policies automatically
- Notify developers via Slack/Email/PagerDuty
- Generate AI-written incident summaries

### Severity Policies
```typescript
const SEVERITY_POLICIES = [
  { name: 'CRITICAL_OUTAGE', condition: status === 'down' && duration > 5min },
  { name: 'HIGH_ERROR_RATE', condition: error_rate > 50% },
  { name: 'DEGRADED_PERFORMANCE', condition: latency > 5000ms },
  // ... more policies
]
```

### Events
- **Subscribes:** `system.health.down`, `system.health.degraded`, `system.health.recovering`
- **Emits:** `dev.alert.sent`

### ⚠️ Important
**NEVER notifies customers directly** - this is an internal agent only.

---

## 🎙 Agent AISHA (Voice Communication)

### Responsibilities
- Act as the **communication layer** for users
- Transform technical agent responses into:
  - Empathetic, natural language
  - Voice-friendly phrasing
  - Non-technical explanations
- **NEVER decides logic** - only communicates what agents decided

### Communication Context
```typescript
interface CommunicationContext {
  tone: 'empathetic' | 'reassuring' | 'informative' | 'apologetic'
  length: 'brief' | 'moderate' | 'detailed'
  customerName: string | null
  hasIssues: boolean
}
```

### Voice Guidelines
- Use contractions (I'm, we're, you'll)
- Keep sentences short
- Vary opening phrases
- End with forward-looking statements

---

## 📡 API Endpoints

### Customer Support

#### Submit Query
```http
POST /api/support/query
Content-Type: application/json

{
  "text": "Where is my order ORD-001-A?",
  "userInfo": {
    "email": "john.doe@email.com"
  },
  "enableVoiceResponse": true
}
```

Response:
```json
{
  "success": true,
  "requestId": "uuid-here",
  "status": "processing"
}
```

#### Get Response
```http
GET /api/support/response/:requestId
```

Response:
```json
{
  "success": true,
  "status": "completed",
  "agent": "havoc",
  "response": "I found your order...",
  "audioUrl": "/audio/response-uuid.mp3"
}
```

### System Health (Sentinel)

#### Trigger Health Event
```http
POST /api/system/health-event
Content-Type: application/json

{
  "service_name": "payment-gateway",
  "status": "down",
  "error_rate": 75,
  "error_message": "Connection timeout to Stripe API",
  "affected_endpoints": ["/api/checkout", "/api/payment"]
}
```

#### List Incidents
```http
GET /api/system/incidents
```

---

## 🔄 Event Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  API Endpoint   │────▶│   Query Router   │────▶│   Agent Havoc   │
│  /api/support   │     │   (LLM-based)    │     │   or Hulk       │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Voice Output   │◀────│   Agent Aisha    │◀────│  *.response     │
│  (TTS/Audio)    │     │  (Communication) │     │  event          │
└─────────────────┘     └──────────────────┘     └─────────────────┘

                    SYSTEM HEALTH FLOW

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Health Event   │────▶│  Agent Sentinel  │────▶│  Notifications  │
│  (External)     │     │  (SRE Agent)     │     │  Slack/Email/PD │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 🧪 Testing

### Test Shipping Query (Havoc)
```bash
curl -X POST http://localhost:3000/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Where is my order?",
    "userInfo": { "email": "john.doe@email.com" }
  }'
```

### Test Payment Query (Hulk)
```bash
curl -X POST http://localhost:3000/api/support/query \
  -H "Content-Type: application/json" \
  -d '{
    "text": "My payment failed",
    "userInfo": { "email": "jane.smith@email.com" }
  }'
```

### Test System Health (Sentinel)
```bash
curl -X POST http://localhost:3000/api/system/health-event \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "api-gateway",
    "status": "down",
    "error_rate": 95,
    "error_message": "Database connection pool exhausted"
  }'
```

---

## 🛡️ Safety Features

### No Hallucination
- Agents only use data from `agentState`
- LLMs cannot invent orders, amounts, or dates
- Fallback responses when LLM fails

### No Static Responses
- All responses are dynamically generated
- Fallbacks only trigger on actual failures
- Responses vary naturally (Aisha)

### Safe Escalation
- Clear severity policies
- Proper notification routing
- Customer-facing vs internal separation

---

## 📊 Monitoring & RCA

All agent failures are logged for Root Cause Analysis:

```typescript
logShippingFailure({
  agent_name: 'havoc',
  request_id: requestId,
  gateway: order.carrier,
  error_message: order.issueDescription,
  metadata: { orderId, daysDelayed }
})
```

Access failure data via the RCA dashboard or API.

---

## 🏗️ Architecture Principles

1. **Event-Driven**: All agent communication via events
2. **Loosely Coupled**: Agents don't call each other directly
3. **Autonomous**: Each agent makes decisions independently
4. **Safe**: LLMs cannot hallucinate system actions
5. **Observable**: All actions logged for RCA

---

## 📝 License

MIT License - Built for the Motia Hackathon

