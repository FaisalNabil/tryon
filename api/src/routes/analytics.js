/**
 * routes/analytics.js
 *
 * Returns aggregated analytics for the shop owner dashboard.
 * All data is about their shop only — never cross-shop.
 */

import { Router } from 'express'
import { prisma } from '../server.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

// ─── GET /analytics/summary ───────────────────────────────────────────
// Main dashboard stats: totals + daily chart + top frames
router.get('/summary', async (req, res, next) => {
  try {
    const period = req.query.period || '7d'
    const since  = getPeriodStart(period)
    const shopId = req.shopId

    // ── Total try-ons in period ───────────────────────────────────────
    const totalTryOns = await prisma.analyticsEvent.count({
      where: { shopId, eventType: 'widget_open', createdAt: { gte: since } },
    })

    // ── Total unique sessions ─────────────────────────────────────────
    const uniqueSessions = await prisma.analyticsEvent.groupBy({
      by: ['sessionId'],
      where: { shopId, createdAt: { gte: since } },
      _count: true,
    })

    // ── Checkout clicks (conversion signal) ───────────────────────────
    const checkouts = await prisma.analyticsEvent.count({
      where: { shopId, eventType: 'checkout_click', createdAt: { gte: since } },
    })

    // ── Top 5 frames by try-on count ──────────────────────────────────
    const topFramesRaw = await prisma.analyticsEvent.groupBy({
      by: ['frameId'],
      where: {
        shopId,
        eventType: 'frame_tried',
        frameId:   { not: null },
        createdAt: { gte: since },
      },
      _count: { frameId: true },
      orderBy: { _count: { frameId: 'desc' } },
      take: 5,
    })

    // Enrich with frame names
    const frameIds = topFramesRaw.map(r => r.frameId).filter(Boolean)
    const frames   = await prisma.frame.findMany({
      where: { id: { in: frameIds } },
      select: { id: true, name: true, imageUrl: true },
    })
    const frameMap = Object.fromEntries(frames.map(f => [f.id, f]))

    const topFrames = topFramesRaw.map(r => ({
      frameId:  r.frameId,
      count:    r._count.frameId,
      name:     frameMap[r.frameId]?.name    || 'Unknown',
      imageUrl: frameMap[r.frameId]?.imageUrl || null,
    }))

    // ── Daily breakdown ───────────────────────────────────────────────
    const dailyRaw = await prisma.$queryRaw`
      SELECT
        DATE(created_at) AS day,
        COUNT(*) FILTER (WHERE event_type = 'widget_open')    AS try_ons,
        COUNT(*) FILTER (WHERE event_type = 'checkout_click') AS checkouts,
        COUNT(DISTINCT session_id)                             AS sessions
      FROM "AnalyticsEvent"
      WHERE shop_id = ${shopId}
        AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `

    const dailyData = dailyRaw.map(row => ({
      date:      row.day.toISOString().slice(0, 10),
      tryOns:    Number(row.try_ons),
      checkouts: Number(row.checkouts),
      sessions:  Number(row.sessions),
    }))

    // ── This month's usage vs plan limit ─────────────────────────────
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthlyTryOns = await prisma.analyticsEvent.count({
      where: { shopId, eventType: 'widget_open', createdAt: { gte: monthStart } },
    })

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { plan: true },
    })
    const tryOnLimit = getPlanTryOnLimit(shop.plan)

    res.json({
      period,
      totalTryOns,
      uniqueSessions: uniqueSessions.length,
      checkouts,
      conversionRate: totalTryOns > 0
        ? Math.round((checkouts / totalTryOns) * 1000) / 10
        : 0,
      topFrames,
      dailyData,
      monthlyUsage: {
        used:    monthlyTryOns,
        limit:   tryOnLimit,
        percent: tryOnLimit === Infinity
          ? 0
          : Math.round((monthlyTryOns / tryOnLimit) * 100),
      },
    })
  } catch (err) { next(err) }
})

// ─── Helpers ─────────────────────────────────────────────────────────
function getPeriodStart(period) {
  const now = new Date()
  switch (period) {
    case '1d':  return new Date(now - 1  * 86400000)
    case '7d':  return new Date(now - 7  * 86400000)
    case '30d': return new Date(now - 30 * 86400000)
    case 'all': return new Date(0)
    default:    return new Date(now - 7  * 86400000)
  }
}

function getPlanTryOnLimit(plan) {
  return { TRIAL: 100, STARTER: 500, GROWTH: 5000, PRO: Infinity }[plan] ?? 100
}

export default router
