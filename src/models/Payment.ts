/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 💳 PAYMENT MODEL - MongoDB Schema for Payment Transactions
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Tracks all payment transactions, failures, and retry attempts.
 * Used by Agent Hulk for payment support and RCA analysis.
 */

import mongoose, { Schema, Document } from 'mongoose'

// Payment status types
export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'cancelled'
  | 'disputed'

// Payment gateway types
export type PaymentGateway = 
  | 'stripe'
  | 'paypal'
  | 'braintree'
  | 'square'
  | 'adyen'
  | 'razorpay'
  | 'unknown'

// Failure reason types
export type FailureReason =
  | 'card_declined'
  | 'insufficient_funds'
  | 'expired_card'
  | 'invalid_cvv'
  | 'bank_rejected'
  | 'fraud_suspected'
  | 'network_error'
  | 'gateway_timeout'
  | 'authentication_failed'
  | 'limit_exceeded'
  | 'unknown'

export interface IPayment extends Document {
  paymentId: string
  customerId: string
  orderId: string
  amount: number
  currency: string
  status: PaymentStatus
  gateway: PaymentGateway
  
  // Transaction details
  transactionId?: string
  authorizationCode?: string
  
  // Card details (masked)
  cardLast4?: string
  cardBrand?: string
  cardExpiryMonth?: number
  cardExpiryYear?: number
  
  // Retry tracking
  retryCount: number
  maxRetries: number
  lastRetryAt?: Date
  nextRetryAt?: Date
  
  // Failure tracking
  failureReason?: FailureReason
  failureMessage?: string
  failureCode?: string
  
  // Refund tracking
  refundEligible: boolean
  refundAmount?: number
  refundedAt?: Date
  refundReason?: string
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  
  // Metadata
  metadata?: Record<string, any>
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled', 'disputed'],
      default: 'pending',
      index: true,
    },
    gateway: {
      type: String,
      enum: ['stripe', 'paypal', 'braintree', 'square', 'adyen', 'razorpay', 'unknown'],
      default: 'unknown',
    },
    
    // Transaction details
    transactionId: String,
    authorizationCode: String,
    
    // Card details
    cardLast4: String,
    cardBrand: String,
    cardExpiryMonth: Number,
    cardExpiryYear: Number,
    
    // Retry tracking
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
    lastRetryAt: Date,
    nextRetryAt: Date,
    
    // Failure tracking
    failureReason: {
      type: String,
      enum: [
        'card_declined',
        'insufficient_funds',
        'expired_card',
        'invalid_cvv',
        'bank_rejected',
        'fraud_suspected',
        'network_error',
        'gateway_timeout',
        'authentication_failed',
        'limit_exceeded',
        'unknown',
      ],
    },
    failureMessage: String,
    failureCode: String,
    
    // Refund tracking
    refundEligible: {
      type: Boolean,
      default: true,
    },
    refundAmount: Number,
    refundedAt: Date,
    refundReason: String,
    
    // Timestamps
    completedAt: Date,
    
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for common queries
PaymentSchema.index({ customerId: 1, status: 1 })
PaymentSchema.index({ orderId: 1, status: 1 })
PaymentSchema.index({ gateway: 1, status: 1, createdAt: -1 })
PaymentSchema.index({ failureReason: 1, createdAt: -1 })

export const Payment = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema)

