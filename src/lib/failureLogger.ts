/**
 * Failure Logger Module
 * 
 * Lightweight module to log failures from agents (payment, fraud, shipping).
 * Logs to the in-memory failure store for RCA analysis.
 */

import { addFailureEvent } from './failureStore'
import type { FailureType, FailureEvent } from './failureStore'

export interface LogFailureOptions {
  failure_type: FailureType
  agent_name: string
  request_id: string
  correlation_id?: string
  gateway?: string
  error_message?: string
  metadata?: Record<string, any>
}

/**
 * Log a failure event
 * 
 * @example
 * // Log a payment failure
 * logFailure({
 *   failure_type: 'payment',
 *   agent_name: 'hulk',
 *   request_id: 'req-123',
 *   gateway: 'stripe',
 *   error_message: 'Card declined',
 * })
 * 
 * @example
 * // Log a shipping failure
 * logFailure({
 *   failure_type: 'shipping',
 *   agent_name: 'havoc',
 *   request_id: 'req-456',
 *   gateway: 'fedex',
 *   error_message: 'Delivery delayed - weather',
 * })
 */
export function logFailure(options: LogFailureOptions): FailureEvent {
  const event = addFailureEvent({
    failure_type: options.failure_type,
    agent_name: options.agent_name,
    gateway: options.gateway,
    timestamp: new Date(),
    request_id: options.request_id,
    correlation_id: options.correlation_id,
    error_message: options.error_message,
    metadata: options.metadata,
  })
  
  // Console log for visibility during development
  console.log(`[FailureLogger] ${options.failure_type.toUpperCase()} failure logged`, {
    agent: options.agent_name,
    gateway: options.gateway,
    request_id: options.request_id,
    error: options.error_message,
  })
  
  return event
}

/**
 * Log a payment failure (convenience method)
 */
export function logPaymentFailure(options: {
  agent_name: string
  request_id: string
  gateway?: string
  error_message?: string
  correlation_id?: string
  metadata?: Record<string, any>
}): FailureEvent {
  return logFailure({
    ...options,
    failure_type: 'payment',
  })
}

/**
 * Log a fraud detection failure (convenience method)
 */
export function logFraudFailure(options: {
  agent_name: string
  request_id: string
  gateway?: string
  error_message?: string
  correlation_id?: string
  metadata?: Record<string, any>
}): FailureEvent {
  return logFailure({
    ...options,
    failure_type: 'fraud',
  })
}

/**
 * Log a shipping failure (convenience method)
 */
export function logShippingFailure(options: {
  agent_name: string
  request_id: string
  gateway?: string  // carrier name: 'fedex', 'ups', 'usps', etc.
  error_message?: string
  correlation_id?: string
  metadata?: Record<string, any>
}): FailureEvent {
  return logFailure({
    ...options,
    failure_type: 'shipping',
  })
}

/**
 * Create a scoped logger for a specific agent
 * 
 * @example
 * const logger = createAgentFailureLogger('hulk', 'payment')
 * logger.log({ request_id: 'req-123', error_message: 'Card declined' })
 */
export function createAgentFailureLogger(
  agent_name: string,
  failure_type: FailureType
) {
  return {
    log: (options: {
      request_id: string
      gateway?: string
      error_message?: string
      correlation_id?: string
      metadata?: Record<string, any>
    }): FailureEvent => {
      return logFailure({
        ...options,
        agent_name,
        failure_type,
      })
    },
  }
}

export type { FailureType, FailureEvent }
