/**
 * middleware/errorHandler.js
 *
 * Catches all unhandled errors thrown by route handlers.
 * Returns consistent JSON error shape to clients.
 */

export function errorHandler(err, req, res, next) {
  // Log to console (replace with Sentry in production)
  console.error(`[Error] ${req.method} ${req.path}`, err)

  // Prisma known errors
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists' })
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' })
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' })
  }

  // Default 500
  const status  = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message

  res.status(status).json({ error: message })
}
