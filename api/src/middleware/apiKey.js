/**
 * middleware/apiKey.js — API key validation for widget endpoints
 *
 * Validates the shop API key from the query string or X-API-Key header.
 * Sets req.shopId on success.
 */

import { prisma } from '../server.js'

export async function requireApiKey(req, res, next) {
  const key = req.query.key || req.headers['x-api-key']

  if (!key) {
    return res.status(401).json({ error: 'API key required' })
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { apiKey: key },
      select: { id: true, plan: true },
    })

    if (!shop) {
      return res.status(403).json({ error: 'Invalid API key' })
    }

    req.shopId = shop.id
    req.shopPlan = shop.plan
    next()
  } catch (err) {
    next(err)
  }
}
