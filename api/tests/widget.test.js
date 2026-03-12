/**
 * tests/widget.test.js — Widget config endpoint tests
 *
 * R2 storage and rembg are mocked globally in setup.js
 */

import { describe, it, expect } from 'vitest'
import { createTestShop, authFetch, apiKeyFetch, getBaseUrl } from './setup.js'

describe('GET /v1/widget/config', () => {
  it('returns config with valid API key', async () => {
    const { shop } = await createTestShop()

    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/widget/config?key=${shop.apiKey}`)

    expect(res.status).toBe(200)
    const config = await res.json()
    expect(config.shopId).toBe(shop.id)
    expect(config.shopName).toBeTruthy()
    expect(config.frames).toEqual([])
    expect(config.settings).toBeDefined()
  })

  it('rejects invalid API key', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/widget/config?key=tk_invalid_key_12345`)

    expect(res.status).toBe(403)
  })

  it('rejects missing API key', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/widget/config`)

    expect(res.status).toBe(401)
  })

  it('returns only active frames', async () => {
    const { token, shop, baseUrl } = await createTestShop()

    // Create two frames
    for (const name of ['Active Frame', 'Inactive Frame']) {
      const form = new FormData()
      form.append('image', new Blob([Buffer.from('fake')], { type: 'image/png' }), 'test.png')
      form.append('name', name)
      await fetch(`${baseUrl}/v1/frames/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
    }

    // List frames and deactivate the second one
    const listRes = await authFetch(token, '/v1/frames')
    const allFrames = await listRes.json()
    const inactive = allFrames.find(f => f.name === 'Inactive Frame')

    await authFetch(token, `/v1/frames/${inactive.id}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
    })

    // Widget config should only return active frames
    const configRes = await fetch(`${baseUrl}/v1/widget/config?key=${shop.apiKey}`)
    const config = await configRes.json()

    expect(config.frames).toHaveLength(1)
    expect(config.frames[0].name).toBe('Active Frame')
  })

  it('works with X-API-Key header', async () => {
    const { shop, baseUrl } = await createTestShop()

    const res = await fetch(`${baseUrl}/v1/widget/config`, {
      headers: { 'X-API-Key': shop.apiKey },
    })

    expect(res.status).toBe(200)
    const config = await res.json()
    expect(config.shopId).toBe(shop.id)
  })
})
