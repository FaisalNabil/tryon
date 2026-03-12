/**
 * tests/frames.test.js — Frame CRUD integration tests
 *
 * R2 storage and rembg are mocked globally in setup.js
 */

import { describe, it, expect } from 'vitest'
import { createTestShop, authFetch } from './setup.js'

describe('GET /v1/frames', () => {
  it('returns empty list for new shop', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/frames')
    expect(res.status).toBe(200)

    const frames = await res.json()
    expect(frames).toEqual([])
  })

  it('returns only frames belonging to the authenticated shop', async () => {
    const shop1 = await createTestShop()
    const shop2 = await createTestShop()

    // Upload a frame to shop1
    const form = new FormData()
    form.append('image', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'test.png')
    form.append('name', 'Shop1 Frame')

    await fetch(`${shop1.baseUrl}/v1/frames/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${shop1.token}` },
      body: form,
    })

    // Shop2 should see empty list
    const res = await authFetch(shop2.token, '/v1/frames')
    const frames = await res.json()
    expect(frames).toEqual([])

    // Shop1 should see 1 frame
    const res1 = await authFetch(shop1.token, '/v1/frames')
    const frames1 = await res1.json()
    expect(frames1).toHaveLength(1)
    expect(frames1[0].name).toBe('Shop1 Frame')
  })
})

describe('POST /v1/frames/upload', () => {
  it('creates a frame with name and style', async () => {
    const { token, baseUrl } = await createTestShop()

    const form = new FormData()
    form.append('image', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'glasses.png')
    form.append('name', 'Aviator Classic')
    form.append('style', 'aviator')

    const res = await fetch(`${baseUrl}/v1/frames/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })

    expect(res.status).toBe(201)
    const frame = await res.json()
    expect(frame.name).toBe('Aviator Classic')
    expect(frame.style).toBe('aviator')
    expect(frame.imageUrl).toContain('cdn.test.com')
  })

  it('rejects request without image file', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/frames/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Image' }),
    })

    // multer won't find a file in JSON body
    expect(res.status).toBe(400)
  })
})

describe('PUT /v1/frames/:id', () => {
  it('updates frame metadata', async () => {
    const { token, baseUrl } = await createTestShop()

    // Create a frame first
    const form = new FormData()
    form.append('image', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'test.png')
    form.append('name', 'Original')
    form.append('style', 'round')

    const createRes = await fetch(`${baseUrl}/v1/frames/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const created = await createRes.json()

    // Update name
    const res = await authFetch(token, `/v1/frames/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated Name', isActive: false }),
    })

    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated.name).toBe('Updated Name')
    expect(updated.isActive).toBe(false)
  })

  it('returns 404 for non-existent frame', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/frames/nonexistent-id', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /v1/frames/:id', () => {
  it('deletes a frame', async () => {
    const { token, baseUrl } = await createTestShop()

    // Create a frame
    const form = new FormData()
    form.append('image', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'test.png')

    const createRes = await fetch(`${baseUrl}/v1/frames/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    const created = await createRes.json()

    // Delete it
    const res = await authFetch(token, `/v1/frames/${created.id}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)

    // Verify it's gone
    const listRes = await authFetch(token, '/v1/frames')
    const frames = await listRes.json()
    expect(frames).toHaveLength(0)
  })

  it('returns 404 for frame owned by another shop', async () => {
    const shop1 = await createTestShop()
    const shop2 = await createTestShop()

    // Create a frame under shop1
    const form = new FormData()
    form.append('image', new Blob([Buffer.from('fake-png')], { type: 'image/png' }), 'test.png')

    const createRes = await fetch(`${shop1.baseUrl}/v1/frames/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${shop1.token}` },
      body: form,
    })
    const created = await createRes.json()

    // Shop2 tries to delete shop1's frame
    const res = await authFetch(shop2.token, `/v1/frames/${created.id}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
  })
})
