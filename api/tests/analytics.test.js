/**
 * tests/analytics.test.js — Analytics ingestion & summary tests
 */

import { describe, it, expect } from 'vitest'
import { createTestShop, authFetch, apiKeyFetch, getBaseUrl } from './setup.js'

describe('POST /v1/analytics/ingest', () => {
  it('ingests a batch of valid events', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/analytics/ingest', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          { eventType: 'widget_open', sessionId: 'sess-1', pageUrl: 'https://shop.com' },
          { eventType: 'frame_tried', sessionId: 'sess-1', pageUrl: 'https://shop.com' },
        ],
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.count).toBe(2)
  })

  it('rejects invalid event types', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/analytics/ingest', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          { eventType: 'invalid_type', sessionId: 'sess-1', pageUrl: 'https://shop.com' },
        ],
      }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects empty events array', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/analytics/ingest', {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects missing events field', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/analytics/ingest', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('stores face ratios on session', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/analytics/ingest', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          {
            eventType: 'face_ratios',
            sessionId: 'face-sess-1',
            pageUrl: 'https://shop.com',
            faceShape: 'oval',
            widthToLength: 0.75,
            jawToCheekbone: 0.85,
            foreheadToJaw: 0.9,
          },
        ],
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.count).toBe(1)
  })
})

describe('GET /v1/analytics/summary', () => {
  it('returns aggregated stats for the shop', async () => {
    const { token, shop } = await createTestShop()

    // Ingest some events first
    await apiKeyFetch(shop.apiKey, '/v1/analytics/ingest', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          { eventType: 'widget_open', sessionId: 'sum-1', pageUrl: 'https://shop.com' },
          { eventType: 'widget_open', sessionId: 'sum-2', pageUrl: 'https://shop.com' },
          { eventType: 'checkout_click', sessionId: 'sum-1', pageUrl: 'https://shop.com' },
        ],
      }),
    })

    // Fetch summary
    const res = await authFetch(token, '/v1/analytics/summary?period=7d')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.period).toBe('7d')
    expect(data.totalTryOns).toBe(2)
    expect(data.checkouts).toBe(1)
    expect(data.monthlyUsage).toBeDefined()
    expect(data.monthlyUsage.limit).toBeDefined()
  })

  it('respects period filter', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/analytics/summary?period=30d')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.period).toBe('30d')
  })

  it('requires JWT auth (not API key)', async () => {
    const { shop } = await createTestShop()

    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/analytics/summary`, {
      headers: { 'X-API-Key': shop.apiKey },
    })

    // /summary requires JWT, not API key
    expect(res.status).toBe(401)
  })
})
