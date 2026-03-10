/**
 * routes/shops.js
 *
 * Shop owner profile and widget settings management.
 * All routes require JWT auth.
 */

import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma, redis } from '../server.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const settingsSchema = z.object({
  shopName:   z.string().min(2).max(100).optional(),
  websiteUrl: z.string().url().optional(),
  widgetSettings: z.object({
    buttonColor:    z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    buttonPosition: z.enum(['bottom-right', 'bottom-left']).optional(),
    buttonText:     z.string().max(30).optional(),
    primaryColor:   z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    modalTitle:     z.string().max(60).optional(),
  }).optional(),
})

// ─── GET /shops/me ────────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: {
        id: true, email: true, shopName: true,
        websiteUrl: true, apiKey: true, plan: true,
        widgetSettings: true, createdAt: true,
        subscription: {
          select: { status: true, plan: true, currentPeriodEnd: true, trialEndsAt: true }
        },
        _count: { select: { frames: true } }
      },
    })

    if (!shop) return res.status(404).json({ error: 'Shop not found' })

    res.json({ shop })
  } catch (err) { next(err) }
})

// ─── PUT /shops/me ────────────────────────────────────────────────────
router.put('/me', async (req, res, next) => {
  try {
    const parsed = settingsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() })
    }

    const { widgetSettings, ...topLevel } = parsed.data

    // Merge widget settings with existing (don't overwrite unset keys)
    let updateData = { ...topLevel }

    if (widgetSettings) {
      const current = await prisma.shop.findUnique({
        where: { id: req.shopId },
        select: { widgetSettings: true },
      })
      updateData.widgetSettings = { ...(current.widgetSettings || {}), ...widgetSettings }
    }

    const shop = await prisma.shop.update({
      where: { id: req.shopId },
      data: updateData,
      select: {
        id: true, email: true, shopName: true,
        websiteUrl: true, apiKey: true, plan: true,
        widgetSettings: true,
      },
    })

    // Invalidate widget cache so new settings apply immediately
    await redis.del(`widget:config:${req.shopId}`)
    await redis.del(`shop:key:${shop.apiKey}`)

    res.json({ shop })
  } catch (err) { next(err) }
})

// ─── POST /shops/regenerate-key ───────────────────────────────────────
// Generates a new API key, invalidates the old one.
// Old embed code will stop working until shop owner updates it.
router.post('/regenerate-key', async (req, res, next) => {
  try {
    const current = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: { apiKey: true },
    })

    // Delete old key from cache
    await redis.del(`shop:key:${current.apiKey}`)
    await redis.del(`widget:config:${req.shopId}`)

    const newKey = 'tk_' + crypto.randomBytes(24).toString('hex')

    const shop = await prisma.shop.update({
      where: { id: req.shopId },
      data: { apiKey: newKey },
      select: { apiKey: true },
    })

    res.json({ apiKey: shop.apiKey })
  } catch (err) { next(err) }
})

export default router
