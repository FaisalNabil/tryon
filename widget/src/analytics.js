/**
 * analytics.js — Widget-side event tracking
 *
 * Batches try-on events and sends them to the API asynchronously.
 * Uses a queue that flushes every 10 seconds or when the page unloads.
 */

let config   = null
let queue    = []
let sessionId = null
let flushTimer = null

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
 */
async function flush() {
  if (!config || queue.length === 0) return

  const events = [...queue]
  queue = []

  try {
    await fetch(`${config._apiBase}/analytics/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config._apiKey,
      },
      body: JSON.stringify({ events }),
      keepalive: true, // Ensures request completes even on page unload
    })
  } catch (err) {
    // Re-queue on failure (will retry on next flush)
    queue.unshift(...events)
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
