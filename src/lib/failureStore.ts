/**
 * In-Memory Failure Events Store
 * 
 * Stores failure events for RCA analysis.
 * In production, this could be backed by a database table.
 */

export type FailureType = 'payment' | 'fraud' | 'shipping'

export interface FailureEvent {
  id: string
  failure_type: FailureType
  agent_name: string
  gateway?: string  // e.g., 'stripe', 'paypal', 'razorpay' for payment; carrier for shipping
  timestamp: Date
  request_id: string
  correlation_id?: string
  error_message?: string
  metadata?: Record<string, any>
}

export interface AggregatedFailure {
  key: string
  count: number
  percentage: number
  first_occurrence: Date
  last_occurrence: Date
}

export interface TimeWindowStats {
  hour: number  // 0-23
  count: number
  percentage: number
}

// In-memory store
const failureEvents: FailureEvent[] = []
const MAX_EVENTS = 10000  // Keep last 10k events to prevent memory issues

/**
 * Add a failure event to the store
 */
export function addFailureEvent(event: Omit<FailureEvent, 'id'>): FailureEvent {
  const id = `fail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const fullEvent: FailureEvent = { ...event, id }
  
  failureEvents.push(fullEvent)
  
  // Trim if exceeds max
  if (failureEvents.length > MAX_EVENTS) {
    failureEvents.shift()
  }
  
  return fullEvent
}

/**
 * Get all failure events, optionally filtered by time range
 */
export function getFailureEvents(options?: {
  since?: Date
  until?: Date
  failure_type?: FailureType
  agent_name?: string
  gateway?: string
}): FailureEvent[] {
  let events = [...failureEvents]
  
  if (options?.since) {
    events = events.filter(e => e.timestamp >= options.since!)
  }
  
  if (options?.until) {
    events = events.filter(e => e.timestamp <= options.until!)
  }
  
  if (options?.failure_type) {
    events = events.filter(e => e.failure_type === options.failure_type)
  }
  
  if (options?.agent_name) {
    events = events.filter(e => e.agent_name === options.agent_name)
  }
  
  if (options?.gateway) {
    events = events.filter(e => e.gateway === options.gateway)
  }
  
  return events
}

/**
 * Get failure count
 */
export function getFailureCount(options?: {
  since?: Date
  failure_type?: FailureType
}): number {
  return getFailureEvents(options).length
}

/**
 * Aggregate failures by a specific field
 */
export function aggregateBy(
  field: 'failure_type' | 'agent_name' | 'gateway',
  options?: { since?: Date; until?: Date }
): AggregatedFailure[] {
  const events = getFailureEvents(options)
  const total = events.length
  
  if (total === 0) return []
  
  const groups: Record<string, FailureEvent[]> = {}
  
  for (const event of events) {
    const key = event[field] || 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }
  
  return Object.entries(groups)
    .map(([key, group]) => ({
      key,
      count: group.length,
      percentage: Math.round((group.length / total) * 100),
      first_occurrence: new Date(Math.min(...group.map(e => e.timestamp.getTime()))),
      last_occurrence: new Date(Math.max(...group.map(e => e.timestamp.getTime()))),
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get failures by hour of day (0-23)
 */
export function getFailuresByHour(options?: {
  since?: Date
  until?: Date
  failure_type?: FailureType
}): TimeWindowStats[] {
  const events = getFailureEvents(options)
  const total = events.length
  
  if (total === 0) return []
  
  const hourCounts: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourCounts[i] = 0
  
  for (const event of events) {
    const hour = event.timestamp.getHours()
    hourCounts[hour]++
  }
  
  return Object.entries(hourCounts)
    .map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
}

/**
 * Get peak failure hours (top N hours with most failures)
 */
export function getPeakFailureHours(
  topN: number = 3,
  options?: { since?: Date; failure_type?: FailureType }
): TimeWindowStats[] {
  return getFailuresByHour(options).slice(0, topN)
}

/**
 * Get gateway failure ranking
 */
export function getGatewayFailureRanking(options?: {
  since?: Date
  failure_type?: FailureType
}): AggregatedFailure[] {
  const events = getFailureEvents({ ...options, gateway: undefined })
    .filter(e => e.gateway) // Only events with gateway
  
  const total = events.length
  if (total === 0) return []
  
  const groups: Record<string, FailureEvent[]> = {}
  
  for (const event of events) {
    const key = event.gateway!
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }
  
  return Object.entries(groups)
    .map(([key, group]) => ({
      key,
      count: group.length,
      percentage: Math.round((group.length / total) * 100),
      first_occurrence: new Date(Math.min(...group.map(e => e.timestamp.getTime()))),
      last_occurrence: new Date(Math.max(...group.map(e => e.timestamp.getTime()))),
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get repeated failure patterns (same error occurring multiple times)
 */
export function getRepeatedPatterns(options?: {
  since?: Date
  minOccurrences?: number
}): { pattern: string; count: number; agent: string; gateway?: string }[] {
  const events = getFailureEvents(options)
  const minCount = options?.minOccurrences || 2
  
  const patterns: Record<string, { count: number; agent: string; gateway?: string }> = {}
  
  for (const event of events) {
    // Create a pattern key from agent + gateway + error type
    const patternKey = `${event.agent_name}:${event.gateway || 'none'}:${event.error_message || 'unknown'}`
    
    if (!patterns[patternKey]) {
      patterns[patternKey] = { count: 0, agent: event.agent_name, gateway: event.gateway }
    }
    patterns[patternKey].count++
  }
  
  return Object.entries(patterns)
    .filter(([_, data]) => data.count >= minCount)
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      agent: data.agent,
      gateway: data.gateway,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Clear all failure events (for testing)
 */
export function clearFailureEvents(): void {
  failureEvents.length = 0
}

/**
 * Get store stats
 */
export function getStoreStats(): {
  total_events: number
  oldest_event?: Date
  newest_event?: Date
} {
  if (failureEvents.length === 0) {
    return { total_events: 0 }
  }
  
  return {
    total_events: failureEvents.length,
    oldest_event: new Date(Math.min(...failureEvents.map(e => e.timestamp.getTime()))),
    newest_event: new Date(Math.max(...failureEvents.map(e => e.timestamp.getTime()))),
  }
}
