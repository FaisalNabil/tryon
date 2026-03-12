/**
 * tests/setup.js — Shared test utilities
 *
 * Sets test env vars, mocks external services, boots the Express app
 * on a random port, and provides helper functions for authenticated requests.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest'

// ── Set test environment BEFORE importing the app ────────────────────
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only'
process.env.PORT = '0' // random port
process.env.DASHBOARD_URL = 'http://localhost:3001'

// Provide dummy R2/Stripe/rembg values so modules don't crash on import
process.env.R2_ENDPOINT = 'https://test.r2.dev'
process.env.R2_ACCESS_KEY_ID = 'test-key'
process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
process.env.R2_BUCKET_NAME = 'test-bucket'
process.env.R2_PUBLIC_URL = 'https://cdn.test.com'
process.env.REMBG_URL = 'http://localhost:5999'
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_fake'
process.env.RESEND_API_KEY = 're_test_fake'

// ── Mock external services BEFORE importing the app ──────────────────
// R2 storage: return a fake CDN URL instead of uploading
vi.mock('../src/services/storage.js', () => ({
  uploadImage: vi.fn(async (buffer, key) => `https://cdn.test.com/test-bucket/${key}`),
  deleteImage: vi.fn(async () => {}),
}))

// rembg: return the original buffer instead of calling the microservice
vi.mock('../src/services/imageProcess.js', () => ({
  removeBackground: vi.fn(async (buf) => buf),
}))

// ── Import app after env is set + mocks registered ───────────────────
const { app, prisma, redis } = await import('../src/server.js')

let server
let baseUrl

beforeAll(async () => {
  // Start server on random port
  server = app.listen(0)
  const port = server.address().port
  baseUrl = `http://localhost:${port}`
})

afterEach(async () => {
  // Clean up test data between tests (order matters for FK constraints)
  await prisma.analyticsEvent.deleteMany()
  await prisma.analyticsSession.deleteMany()
  await prisma.frame.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.shop.deleteMany()
})

afterAll(async () => {
  server?.close()
  await prisma.$disconnect()
  redis.disconnect()
})

// ── Helper: create a test shop and get auth token ────────────────────
let testCounter = 0

export async function createTestShop(overrides = {}) {
  testCounter++
  const email = overrides.email || `test${testCounter}-${Date.now()}@example.com`
  const password = overrides.password || 'TestPass123!'
  const shopName = overrides.shopName || `Test Shop ${testCounter}`

  const res = await fetch(`${baseUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, shopName }),
  })

  const data = await res.json()
  return {
    ...data,
    email,
    password,
    baseUrl,
  }
}

// ── Helper: make an authenticated fetch ──────────────────────────────
export function authFetch(token, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
}

// ── Helper: make an API-key authenticated fetch ──────────────────────
export function apiKeyFetch(apiKey, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers,
    },
  })
}

// ── Export base URL getter ───────────────────────────────────────────
export function getBaseUrl() {
  return baseUrl
}
