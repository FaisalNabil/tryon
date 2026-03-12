/**
 * server.js — Express API entry point
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

import authRoutes     from './routes/auth.js'
import shopRoutes     from './routes/shops.js'
import frameRoutes    from './routes/frames.js'
import widgetRoutes   from './routes/widget.js'
import analyticsRoutes from './routes/analytics.js'
import billingRoutes  from './routes/billing.js'
import mlRoutes       from './routes/ml.js'

import { errorHandler } from './middleware/errorHandler.js'

// ─── Init DB + Cache ─────────────────────────────────────────────────
export const prisma = new PrismaClient()
export const redis  = new Redis(process.env.REDIS_URL)

redis.on('error', (err) => console.error('Redis error:', err))

// ─── App setup ───────────────────────────────────────────────────────
const app = express()

// Security headers
app.use(helmet())

// CORS — allow all origins for widget + ML APIs, restrict dashboard API
app.use('/v1/widget', cors({ origin: '*' }))
app.use('/v1/ml', cors({ origin: '*' }))
app.use('/v1', cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
  credentials: true,
}))

// Body parsing
// NOTE: Stripe webhooks need raw body — mount before express.json()
app.use('/v1/billing/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '10mb' }))

// ─── Routes ──────────────────────────────────────────────────────────
app.use('/v1/auth',      authRoutes)
app.use('/v1/shops',     shopRoutes)
app.use('/v1/frames',    frameRoutes)
app.use('/v1/widget',    widgetRoutes)
app.use('/v1/analytics', analyticsRoutes)
app.use('/v1/billing',   billingRoutes)
app.use('/v1/ml',        mlRoutes)

// Health check
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }))

// Global error handler (must be last)
app.use(errorHandler)

// ─── Export app for testing ────────────────────────────────────────────
export { app }

// ─── Start (skip when imported by tests) ──────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000

  app.listen(PORT, () => {
    console.log(`[API] Running on http://localhost:${PORT}`)
  })
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
})
