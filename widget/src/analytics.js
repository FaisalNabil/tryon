/**
 * analytics.js — Widget-side event tracking
 *
 * Batches try-on events and sends them to the API asynchronously.
 * Uses a queue that flushes every 10 seconds or when the page unloads.
 * Includes retry with exponential backoff and queue size cap.
 */

const MAX_QUEUE_SIZE = 500
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

let config      = null
let queue        = []
let sessionId    = null
let flushTimer   = null
let retryCount   = 0

/**
 * Initialize analytics with the widget config.
 * Must be called before trackEvent.
 */
export function initAnalytics(shopConfig) {
  config    = shopConfig
  sessionId = crypto.randomUUID()

  // Flush queue every 10 seconds
  flushTimer = setInterval(flush, 10_000)

  // Flush on page unload
  window.addEventListener('beforeunload', flush)
}

/**
 * Track a widget event.
 * @param {string} eventType - One of: widget_open, frame_tried, checkout_click
 * @param {object} [metadata] - Optional extra data (e.g. { frameId })
 */
export function trackEvent(eventType, metadata = {}) {
  if (!config) {
    console.warn('[TryOn] Analytics not initialized')
    return
  }

  // Cap queue size to prevent unbounded memory growth
  if (queue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest events to make room
    queue = queue.slice(queue.length - MAX_QUEUE_SIZE + 1)
  }

  queue.push({
    eventType,
    sessionId,
    frameId:   metadata.frameId || null,
    pageUrl:   window.location.href,
    timestamp: Date.now(),
    ...metadata,
  })
}

/**
 * Flush the event queue to the API.
 * Retries with exponential backoff on failure (max 3 retries).
 */
async function flush() {
  if (!config || queue.length === 0) return

  const events = [...queue]
  queue = []

  try {
    const res = await fetch(`${config._apiBase}/analytics/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config._apiKey,
      },
      body: JSON.stringify({ events }),
      keepalive: true, // Ensures request completes even on page unload
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    // Reset retry counter on success
    retryCount = 0
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      // Re-queue events (respecting cap)
      const requeued = [...events, ...queue]
      queue = requeued.slice(-MAX_QUEUE_SIZE)
      retryCount++

      // Schedule retry with exponential backoff
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount - 1)
      setTimeout(flush, delay)
    } else {
      // Drop events after max retries to prevent stale data buildup
      console.warn(`[TryOn] Analytics: dropping ${events.length} events after ${MAX_RETRIES} retries`)
      retryCount = 0
    }
  }
}

/**
 * Cleanup analytics (stop timer, flush remaining events).
 */
export function destroyAnalytics() {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  flush()
}
