/**
 * tests/auth.test.js — Authentication integration tests
 */

import { describe, it, expect } from 'vitest'
import { createTestShop, authFetch, getBaseUrl } from './setup.js'

describe('POST /v1/auth/register', () => {
  it('creates a new shop and returns token + shop data', async () => {
    const { token, shop } = await createTestShop({
      email: 'new@shop.com',
      shopName: 'My Shop',
    })

    expect(token).toBeTruthy()
    expect(shop.id).toBeTruthy()
    expect(shop.email).toBe('new@shop.com')
    expect(shop.shopName).toBe('My Shop')
    expect(shop.apiKey).toMatch(/^tk_/)
  })

  it('rejects missing fields', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
    expect(data.fields).toBeDefined()
  })

  it('rejects invalid email format', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'Pass1234!', shopName: 'Shop' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Validation failed')
  })

  it('rejects short password (< 8 chars)', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'short@pw.com', password: '123', shopName: 'Shop' }),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.fields.some(f => f.field === 'password')).toBe(true)
  })

  it('rejects duplicate email', async () => {
    await createTestShop({ email: 'dup@test.com' })

    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@test.com', password: 'Pass1234!', shopName: 'Dup Shop' }),
    })

    expect(res.status).toBe(409)
  })
})

describe('POST /v1/auth/login', () => {
  it('returns token on valid credentials', async () => {
    const { email, password } = await createTestShop({ email: 'login@test.com' })

    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.token).toBeTruthy()
    expect(data.shop.email).toBe('login@test.com')
  })

  it('rejects wrong password', async () => {
    await createTestShop({ email: 'wrongpw@test.com' })

    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrongpw@test.com', password: 'WrongPass!' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects missing email', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'anything' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('GET /v1/shops/me (auth check)', () => {
  it('returns shop data with valid token', async () => {
    const { token } = await createTestShop()

    const res = await authFetch(token, '/v1/shops/me')
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.shop.id).toBeTruthy()
    expect(data.shop.email).toBeTruthy()
  })

  it('rejects invalid token', async () => {
    const res = await authFetch('invalid-token', '/v1/shops/me')
    expect(res.status).toBe(401)
  })

  it('rejects missing token', async () => {
    const base = getBaseUrl()
    const res = await fetch(`${base}/v1/shops/me`)
    expect(res.status).toBe(401)
  })
})
