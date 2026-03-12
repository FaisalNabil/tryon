/**
 * middleware/errorHandler.js
 *
 * Catches all unhandled errors thrown by route handlers.
 * Returns consistent JSON error shape to clients.
 */

import { ZodError } from 'zod'

export function errorHandler(err, req, res, next) {
  // Log to console (replace with Sentry in production)
  console.error(`[Error] ${req.method} ${req.path}`, err)

  // ── Zod validation errors ────────────────────────────────────────
  if (err instanceof ZodError) {
    const fields = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }))
    return res.status(400).json({ error: 'Validation failed', fields })
  }

  // ── JWT errors ───────────────────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' })
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' })
  }

  // ── Stripe errors ────────────────────────────────────────────────
  if (err.type?.startsWith('Stripe')) {
    const status = err.statusCode || 402
    return res.status(status).json({ error: err.message })
  }

  // ── Prisma known errors ──────────────────────────────────────────
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists' })
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' })
  }

  // ── Multer errors (file upload) ──────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' })
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field' })
  }
  if (err.message === 'FILE_TYPE_NOT_ALLOWED') {
    return res.status(400).json({ error: 'Only PNG, JPEG, and WebP images are allowed' })
  }

  // ── Default ──────────────────────────────────────────────────────
  const status  = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message

  res.status(status).json({ error: message })
}
