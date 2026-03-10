/**
 * routes/billing.js
 *
 * Stripe subscription management.
 *
 * Flow:
 *  1. Shop clicks "Upgrade" in dashboard
 *  2. POST /billing/create-checkout → returns Stripe Checkout URL
 *  3. Shop is redirected to Stripe-hosted payment page
 *  4. After payment, Stripe sends webhook to POST /billing/webhook
 *  5. We update subscription status in DB
 *
 * Stripe docs: https://stripe.com/docs/billing/subscriptions/overview
 */

import { Router } from 'express'
import Stripe from 'stripe'
import { prisma, redis } from '../server.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Plan → Stripe Price ID mapping
const PLAN_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth:  process.env.STRIPE_PRICE_GROWTH,
  pro:     process.env.STRIPE_PRICE_PRO,
}

const STRIPE_PLAN_MAP = {
  [process.env.STRIPE_PRICE_STARTER]: 'STARTER',
  [process.env.STRIPE_PRICE_GROWTH]:  'GROWTH',
  [process.env.STRIPE_PRICE_PRO]:     'PRO',
}

// ─── GET /billing/subscription ────────────────────────────────────────
router.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: {
        plan: true,
        subscription: {
          select: {
            status: true, plan: true,
            currentPeriodEnd: true, trialEndsAt: true,
            cancelledAt: true,
          }
        }
      },
    })

    res.json({
      plan:         shop.plan,
      subscription: shop.subscription,
    })
  } catch (err) { next(err) }
})

// ─── POST /billing/create-checkout ────────────────────────────────────
// Creates a Stripe Checkout session and returns the redirect URL.
router.post('/create-checkout', requireAuth, async (req, res, next) => {
  try {
    const { plan } = req.body
    const priceId  = PLAN_PRICES[plan?.toLowerCase()]

    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan. Choose: starter, growth, or pro' })
    }

    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: { email: true, shopName: true, subscription: { select: { stripeCustomerId: true } } },
    })

    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3001'

    const session = await stripe.checkout.sessions.create({
      mode:    'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],

      // Pre-fill email if we have it
      customer_email: shop.subscription?.stripeCustomerId
        ? undefined
        : shop.email,
      customer: shop.subscription?.stripeCustomerId || undefined,

      // Trial period (14 days)
      subscription_data: {
        trial_period_days: 14,
        metadata: { shopId: req.shopId },
      },

      success_url: `${dashboardUrl}/billing?success=true`,
      cancel_url:  `${dashboardUrl}/billing?cancelled=true`,

      metadata: { shopId: req.shopId },
    })

    res.json({ checkoutUrl: session.url })
  } catch (err) { next(err) }
})

// ─── POST /billing/portal ─────────────────────────────────────────────
// Opens Stripe Customer Portal so shop can manage/cancel subscription.
router.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({
      where: { id: req.shopId },
      select: { subscription: { select: { stripeCustomerId: true } } },
    })

    if (!shop.subscription?.stripeCustomerId) {
      return res.status(400).json({ error: 'No active subscription found' })
    }

    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3001'

    const session = await stripe.billingPortal.sessions.create({
      customer:   shop.subscription.stripeCustomerId,
      return_url: `${dashboardUrl}/billing`,
    })

    res.json({ portalUrl: session.url })
  } catch (err) { next(err) }
})

// ─── POST /billing/webhook ────────────────────────────────────────────
// Stripe calls this endpoint when subscription events happen.
// Must use raw body (see server.js where we mount this before express.json())
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    await handleStripeEvent(event)
    res.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook handler error:', err)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
})

// ─── Stripe Event Handler ─────────────────────────────────────────────
async function handleStripeEvent(event) {
  const data = event.data.object

  switch (event.type) {

    case 'checkout.session.completed': {
      // Payment succeeded, subscription created
      const shopId     = data.metadata.shopId
      const customerId = data.customer
      const subId      = data.subscription

      // Fetch full subscription from Stripe
      const sub = await stripe.subscriptions.retrieve(subId)
      const priceId = sub.items.data[0].price.id
      const plan = STRIPE_PLAN_MAP[priceId] || 'STARTER'

      await prisma.$transaction([
        prisma.shop.update({
          where: { id: shopId },
          data:  { plan },
        }),
        prisma.subscription.upsert({
          where:  { shopId },
          create: {
            shopId,
            stripeSubId:        sub.id,
            stripeCustomerId:   customerId,
            plan,
            status:             sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
            trialEndsAt:        sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          },
          update: {
            stripeSubId:        sub.id,
            stripeCustomerId:   customerId,
            plan,
            status:             sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
          },
        }),
      ])

      // Bust cache
      await invalidateShopCache(shopId)
      break
    }

    case 'customer.subscription.updated': {
      // Plan changed, renewal, trial ended
      const sub     = data
      const shopId  = sub.metadata.shopId
      if (!shopId) break

      const priceId = sub.items.data[0].price.id
      const plan    = STRIPE_PLAN_MAP[priceId] || 'STARTER'

      await prisma.$transaction([
        prisma.shop.update({ where: { id: shopId }, data: { plan } }),
        prisma.subscription.update({
          where: { shopId },
          data: {
            plan,
            status:             sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
          },
        }),
      ])

      await invalidateShopCache(shopId)
      break
    }

    case 'customer.subscription.deleted': {
      // Subscription cancelled
      const sub    = data
      const shopId = sub.metadata.shopId
      if (!shopId) break

      await prisma.$transaction([
        prisma.shop.update({ where: { id: shopId }, data: { plan: 'TRIAL' } }),
        prisma.subscription.update({
          where: { shopId },
          data:  { status: 'cancelled', cancelledAt: new Date() },
        }),
      ])

      await invalidateShopCache(shopId)
      break
    }

    case 'invoice.payment_failed': {
      // Recurring payment failed
      const customerId = data.customer
      const sub = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        select: { shopId: true },
      })
      if (!sub) break

      await prisma.subscription.update({
        where: { shopId: sub.shopId },
        data:  { status: 'past_due' },
      })

      await invalidateShopCache(sub.shopId)
      break
    }
  }
}

async function invalidateShopCache(shopId) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { apiKey: true },
  })
  if (shop) {
    await redis.del(`shop:key:${shop.apiKey}`)
    await redis.del(`widget:config:${shopId}`)
  }
}

export default router
