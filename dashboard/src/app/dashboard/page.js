'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { analytics, shop as shopApi } from '../../lib/api'

const PERIODS = [
  { label: '24h',   value: '1d'  },
  { label: '7 days', value: '7d'  },
  { label: '30 days', value: '30d' },
]

export default function DashboardPage() {
  const [data,    setData]    = useState(null)
  const [shopInfo, setShopInfo] = useState(null)
  const [period,  setPeriod]  = useState('7d')
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => { loadShop() }, [])
  useEffect(() => { loadAnalytics() }, [period])

  async function loadShop() {
    try {
      const { shop } = await shopApi.me()
      setShopInfo(shop)
    } catch {}
  }

  async function loadAnalytics() {
    setLoading(true)
    setError('')
    try {
      const result = await analytics.summary(period)
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const planLimit  = data?.monthlyUsage
  const usagePct   = planLimit?.percent ?? 0

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {shopInfo ? `Welcome back 👋` : 'Dashboard'}
          </h1>
          {shopInfo && (
            <p className="text-sm text-gray-500 mt-1">{shopInfo.shopName}</p>
          )}
        </div>
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                period === p.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm p-4 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Try-ons"
          value={loading ? '—' : data?.totalTryOns?.toLocaleString()}
          sub="widget opens"
          icon="👓"
        />
        <StatCard
          label="Sessions"
          value={loading ? '—' : data?.uniqueSessions?.toLocaleString()}
          sub="unique visitors"
          icon="👤"
        />
        <StatCard
          label="Checkouts"
          value={loading ? '—' : data?.checkouts?.toLocaleString()}
          sub="clicked buy"
          icon="🛒"
        />
        <StatCard
          label="Conversion"
          value={loading ? '—' : `${data?.conversionRate ?? 0}%`}
          sub="try-on → buy"
          icon="📈"
          highlight
        />
      </div>

      {/* ── Usage meter ────────────────────────────────────────────── */}
      {planLimit && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly try-on usage</span>
            <span className="text-sm text-gray-500">
              {planLimit.used.toLocaleString()} / {planLimit.limit === Infinity ? '∞' : planLimit.limit.toLocaleString()}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-yellow-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
          {usagePct > 80 && (
            <p className="text-xs text-yellow-700 mt-2">
              ⚠️ Approaching limit.{' '}
              <Link href="/dashboard/billing" className="underline">Upgrade your plan</Link>
            </p>
          )}
        </div>
      )}

      {/* ── Chart ──────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-6">Try-ons over time</h2>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : data?.dailyData?.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailyData} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, name) => [v, name === 'tryOns' ? 'Try-ons' : 'Checkouts']}
                labelFormatter={l => `Date: ${l}`}
              />
              <Line type="monotone" dataKey="tryOns" stroke="#6366f1" strokeWidth={2} dot={false} name="tryOns" />
              <Line type="monotone" dataKey="checkouts" stroke="#10b981" strokeWidth={2} dot={false} name="checkouts" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-sm gap-3">
            <span className="text-4xl">📭</span>
            <p>No data yet for this period.</p>
            <Link href="/dashboard/embed" className="text-indigo-600 text-sm hover:underline">
              Install the widget to start tracking →
            </Link>
          </div>
        )}
      </div>

      {/* ── Top Frames ─────────────────────────────────────────────── */}
      {data?.topFrames?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Top frames</h2>
          <div className="space-y-3">
            {data.topFrames.map((frame, i) => (
              <div key={frame.frameId} className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                {frame.imageUrl && (
                  <img src={frame.imageUrl} alt={frame.name}
                    className="w-12 h-6 object-contain bg-gray-50 rounded border" />
                )}
                <span className="flex-1 text-sm text-gray-700 font-medium">{frame.name}</span>
                <span className="text-sm text-gray-500">{frame.count} tries</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick actions (shown when no data) ─────────────────────── */}
      {!loading && data?.totalTryOns === 0 && (
        <div className="card border-dashed border-2 border-indigo-200 bg-indigo-50">
          <h2 className="font-semibold text-indigo-900 mb-2">🚀 Get started</h2>
          <p className="text-sm text-indigo-700 mb-4">
            Complete these steps to start getting try-ons:
          </p>
          <div className="space-y-3">
            {[
              { href: '/dashboard/frames', label: '1. Upload your glasses frames', icon: '👓' },
              { href: '/dashboard/embed',  label: '2. Add the widget to your website', icon: '🔧' },
            ].map(step => (
              <Link key={step.href} href={step.href}
                className="flex items-center gap-3 text-sm text-indigo-800 hover:text-indigo-900 font-medium">
                <span>{step.icon}</span>
                <span className="underline">{step.label}</span>
                <span>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function StatCard({ label, value, sub, icon, highlight }) {
  return (
    <div className={`card ${highlight ? 'border-indigo-200 bg-indigo-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
            {value}
          </p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}
