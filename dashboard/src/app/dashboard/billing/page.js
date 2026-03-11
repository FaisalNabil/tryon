'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { billing as billingApi } from '../../../lib/api'

const PLANS = [
  {
    id:       'starter',
    name:     'Starter',
    price:    19,
    frames:   '20 frames',
    tryOns:   '500 try-ons/mo',
    features: ['Widget on 1 website', 'Email support', 'Basic analytics'],
  },
  {
    id:       'growth',
    name:     'Growth',
    price:    39,
    frames:   '100 frames',
    tryOns:   '5,000 try-ons/mo',
    features: ['Widget on unlimited websites', 'Priority support', 'Full analytics', 'Face shape recommendations'],
    popular:  true,
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    79,
    frames:   'Unlimited frames',
    tryOns:   'Unlimited try-ons',
    features: ['Everything in Growth', 'Analytics API access', 'Custom branding removal', 'Dedicated support'],
  },
]

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 py-12">Loading...</div>}>
      <BillingContent />
    </Suspense>
  )
}

function BillingContent() {
  const params = useSearchParams()
  const [sub,       setSub]       = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [upgrading, setUpgrading] = useState(null)
  const [portal,    setPortal]    = useState(false)
  const [notice,    setNotice]    = useState('')

  useEffect(() => {
    if (params.get('success') === 'true') setNotice('✅ Subscription activated! Thank you.')
    if (params.get('cancelled') === 'true') setNotice('Payment cancelled — no charge was made.')
    load()
  }, [])

  async function load() {
    try {
      const data = await billingApi.subscription()
      setSub(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpgrade(plan) {
    setUpgrading(plan)
    try {
      const { checkoutUrl } = await billingApi.createCheckout(plan)
      window.location.href = checkoutUrl
    } catch (err) {
      alert(err.message)
      setUpgrading(null)
    }
  }

  async function handlePortal() {
    setPortal(true)
    try {
      const { portalUrl } = await billingApi.openPortal()
      window.location.href = portalUrl
    } catch (err) {
      alert(err.message)
      setPortal(false)
    }
  }

  const currentPlan = sub?.plan?.toLowerCase()

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription</p>
      </div>

      {notice && (
        <div className={`text-sm p-4 rounded-lg border ${
          notice.startsWith('✅')
            ? 'bg-green-50 text-green-700 border-green-100'
            : 'bg-yellow-50 text-yellow-700 border-yellow-100'
        }`}>
          {notice}
        </div>
      )}

      {/* Current plan status */}
      {!loading && sub && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current plan</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {sub.plan || 'Trial'}
                {sub.subscription?.status === 'trialing' && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-normal">
                    Trial
                  </span>
                )}
              </p>
              {sub.subscription?.trialEndsAt && sub.subscription.status === 'trialing' && (
                <p className="text-xs text-gray-400 mt-1">
                  Trial ends: {new Date(sub.subscription.trialEndsAt).toLocaleDateString()}
                </p>
              )}
              {sub.subscription?.currentPeriodEnd && (
                <p className="text-xs text-gray-400 mt-1">
                  Next billing: {new Date(sub.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            {sub.subscription && (
              <button onClick={handlePortal} disabled={portal}
                className="btn-secondary">
                {portal ? 'Opening...' : 'Manage subscription'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          return (
            <div key={plan.id}
              className={`card flex flex-col relative ${
                plan.popular ? 'border-indigo-400 ring-2 ring-indigo-400 ring-opacity-30' : ''
              }`}>

              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-400 text-sm">/month</span>
                </div>
              </div>

              <div className="space-y-1 mb-6 text-sm text-gray-600">
                <p className="font-medium text-gray-900">✓ {plan.frames}</p>
                <p className="font-medium text-gray-900">✓ {plan.tryOns}</p>
                {plan.features.map(f => (
                  <p key={f} className="text-gray-500">✓ {f}</p>
                ))}
              </div>

              <div className="mt-auto">
                {isCurrent ? (
                  <div className="text-center py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg">
                    ✓ Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={!!upgrading}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      plan.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
                        : 'btn-secondary'
                    }`}
                  >
                    {upgrading === plan.id ? 'Redirecting...' : 'Start free trial'}
                  </button>
                )}
              </div>

            </div>
          )
        })}
      </div>

      <p className="text-xs text-center text-gray-400">
        All plans include a 14-day free trial · Cancel anytime · Payments powered by Stripe
      </p>

    </div>
  )
}
