/**
 * routes/widget.js — Public widget endpoints
 *
 * These endpoints are authenticated via API key (not JWT).
 * They serve the widget configuration and frame data to the
 * embedded widget on the shop's website.
 */

import { Router } from 'express'
import { prisma, redis } from '../server.js'
import { requireApiKey } from '../middleware/apiKey.js'

const router = Router()

const CACHE_TTL = 300 // 5 minutes

// ─── GET /config — Widget configuration ─────────────────────────────
// Called by bootstrap.js on widget init.
// Returns frames, widget settings, and branding for this shop.
router.get('/config', requireApiKey, async (req, res, next) => {
  try {
    const shopId = req.shopId

    // Check Redis cache first
    const cacheKey = `widget:config:${shopId}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      return res.json(JSON.parse(cached))
    }

    // Fetch shop + active frames from DB
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: {
        id: true,
        shopName: true,
        plan: true,
        widgetSettings: true,
      },
    })

    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' })
    }

    const frames = await prisma.frame.findMany({
      where: { shopId, isActive: true },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        style: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const config = {
      shopId: shop.id,
      shopName: shop.shopName,
      frames,
      settings: shop.widgetSettings || {},
    }

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(config), 'EX', CACHE_TTL)

    res.json(config)
  } catch (err) { next(err) }
})

export default router
