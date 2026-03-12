/**
 * tests/ml.test.js — ML fit-score endpoint tests
 */

import { describe, it, expect } from 'vitest'
import { createTestShop, authFetch, apiKeyFetch, getBaseUrl } from './setup.js'

describe('POST /v1/ml/fit-score', () => {
  it('returns fit score for valid inputs (API key auth)', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/ml/fit-score', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'oval',
        frameStyle: 'aviator',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.score).toBeGreaterThanOrEqual(0)
    expect(data.score).toBeLessThanOrEqual(100)
    expect(data.label).toBeTruthy()
    expect(data.method).toBe('rules')
  })

  it('returns fit score with JWT auth', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/ml/fit-score', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'round',
        frameStyle: 'rectangular',
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.score).toBeGreaterThanOrEqual(0)
  })

  it('rejects invalid face shape', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/ml/fit-score', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'triangle',
        frameStyle: 'aviator',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects invalid frame style', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/ml/fit-score', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'oval',
        frameStyle: 'nonexistent',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects missing authentication', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/ml/fit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        faceShape: 'oval',
        frameStyle: 'aviator',
      }),
    })

    expect(res.status).toBe(401)
  })
})

describe('POST /v1/ml/fit-score-batch', () => {
  it('returns scores for multiple frame styles', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/ml/fit-score-batch', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'heart',
        frameStyles: ['rectangular', 'round', 'cat_eye', 'aviator'],
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.scores).toHaveLength(4)

    // Each score should have required fields
    for (const s of data.scores) {
      expect(s.style).toBeTruthy()
      expect(s.score).toBeGreaterThanOrEqual(0)
      expect(s.score).toBeLessThanOrEqual(100)
      expect(s.label).toBeTruthy()
    }

    // Should be sorted by score descending
    const scores = data.scores.map(s => s.score)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })

  it('rejects empty frameStyles array', async () => {
    const { shop } = await createTestShop()

    const res = await apiKeyFetch(shop.apiKey, '/v1/ml/fit-score-batch', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'oval',
        frameStyles: [],
      }),
    })

    expect(res.status).toBe(400)
  })

  it('works with JWT auth too', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/ml/fit-score-batch', {
      method: 'POST',
      body: JSON.stringify({
        faceShape: 'square',
        frameStyles: ['round', 'cat_eye'],
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.scores).toHaveLength(2)
  })
})
