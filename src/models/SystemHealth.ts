/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🚨 SYSTEM HEALTH MODEL - MongoDB Schema for Infrastructure Monitoring
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Tracks system health events, incidents, and alerts.
 * Used by Agent Sentinel for SRE/DevOps monitoring.
 */

import mongoose, { Schema, Document } from 'mongoose'

// Health status types
export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'recovering'

// Severity levels
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

// Service types
export type ServiceType = 
  | 'api-gateway'
  | 'database'
  | 'cache'
  | 'message-queue'
  | 'payment-processor'
  | 'shipping-provider'
  | 'email-service'
  | 'storage'
  | 'cdn'
  | 'auth-service'
  | 'external-api'
  | 'unknown'

// Notification channels
export type NotificationChannel = 'slack' | 'email' | 'pagerduty' | 'console' | 'sms'

export interface IHealthEvent extends Document {
  eventId: string
  incidentId?: string
  serviceName: string
  serviceType: ServiceType
  
  // Status
  status: HealthStatus
  previousStatus?: HealthStatus
  severity: SeverityLevel
  
  // Metrics
  errorRate?: number
  latencyMs?: number
  requestCount?: number
  errorCount?: number
  
  // Event details
  eventType: string
  errorMessage?: string
  affectedEndpoints?: string[]
  
  // Incident tracking
  startedAt: Date
  resolvedAt?: Date
  acknowledgedAt?: Date
  acknowledgedBy?: string
  
  // Resolution
  resolutionNotes?: string
  rootCause?: string
  
  // Notifications
  notificationsSent: NotificationChannel[]
  escalated: boolean
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  
  // Metadata
  metadata?: Record<string, any>
}

export interface IIncident extends Document {
  incidentId: string
  title: string
  serviceName: string
  severity: SeverityLevel
  status: 'open' | 'investigating' | 'identified' | 'monitoring' | 'resolved'
  
  // Summary
  summary: string
  impact: string
  
  // Timeline
  detectedAt: Date
  acknowledgedAt?: Date
  mitigatedAt?: Date
  resolvedAt?: Date
  
  // Related events
  relatedEventIds: string[]
  
  // Team
  assignedTo?: string
  escalatedTo?: string
  
  // Resolution
  rootCause?: string
  resolution?: string
  postMortemUrl?: string
  
  // Notifications
  notificationChannels: NotificationChannel[]
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  
  // Metadata
  metadata?: Record<string, any>
}

const HealthEventSchema = new Schema<IHealthEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    incidentId: {
      type: String,
      index: true,
    },
    serviceName: {
      type: String,
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      enum: [
        'api-gateway',
        'database',
        'cache',
        'message-queue',
        'payment-processor',
        'shipping-provider',
        'email-service',
        'storage',
        'cdn',
        'auth-service',
        'external-api',
        'unknown',
      ],
      default: 'unknown',
    },
    
    // Status
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'down', 'recovering'],
      required: true,
      index: true,
    },
    previousStatus: {
      type: String,
      enum: ['healthy', 'degraded', 'down', 'recovering'],
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      required: true,
      index: true,
    },
    
    // Metrics
    errorRate: Number,
    latencyMs: Number,
    requestCount: Number,
    errorCount: Number,
    
    // Event details
    eventType: {
      type: String,
      required: true,
    },
    errorMessage: String,
    affectedEndpoints: [String],
    
    // Incident tracking
    startedAt: {
      type: Date,
      required: true,
    },
    resolvedAt: Date,
    acknowledgedAt: Date,
    acknowledgedBy: String,
    
    // Resolution
    resolutionNotes: String,
    rootCause: String,
    
    // Notifications
    notificationsSent: [{
      type: String,
      enum: ['slack', 'email', 'pagerduty', 'console', 'sms'],
    }],
    escalated: {
      type: Boolean,
      default: false,
    },
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
)

const IncidentSchema = new Schema<IIncident>(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'identified', 'monitoring', 'resolved'],
      default: 'open',
      index: true,
    },
    
    // Summary
    summary: {
      type: String,
      required: true,
    },
    impact: String,
    
    // Timeline
    detectedAt: {
      type: Date,
      required: true,
    },
    acknowledgedAt: Date,
    mitigatedAt: Date,
    resolvedAt: Date,
    
    // Related events
    relatedEventIds: [String],
    
    // Team
    assignedTo: String,
    escalatedTo: String,
    
    // Resolution
    rootCause: String,
    resolution: String,
    postMortemUrl: String,
    
    // Notifications
    notificationChannels: [{
      type: String,
      enum: ['slack', 'email', 'pagerduty', 'console', 'sms'],
    }],
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for common queries
HealthEventSchema.index({ serviceName: 1, createdAt: -1 })
HealthEventSchema.index({ severity: 1, status: 1, createdAt: -1 })
HealthEventSchema.index({ eventType: 1, createdAt: -1 })

IncidentSchema.index({ status: 1, severity: 1, createdAt: -1 })
IncidentSchema.index({ serviceName: 1, status: 1 })

export const HealthEvent = mongoose.models.HealthEvent || mongoose.model<IHealthEvent>('HealthEvent', HealthEventSchema)
export const Incident = mongoose.models.Incident || mongoose.model<IIncident>('Incident', IncidentSchema)

