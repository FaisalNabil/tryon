'use client'

import { useEffect, useState } from 'react'
import { shop as shopApi } from '../../../lib/api'

const CDN = process.env.NEXT_PUBLIC_WIDGET_CDN || 'https://cdn.yourdomain.com'

export default function EmbedPage() {
  const [shopInfo, setShopInfo] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [copied,   setCopied]   = useState('')
  const [regen,    setRegen]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { shop } = await shopApi.me()
      setShopInfo(shop)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegenerate() {
    if (!confirm('Regenerate API key? Your current embed code will stop working until you update it.')) return
    setRegen(true)
    try {
      const { apiKey } = await shopApi.regenerateKey()
      setShopInfo(prev => ({ ...prev, apiKey }))
    } finally {
      setRegen(false)
    }
  }

  function copy(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const scriptTag = shopInfo
    ? `<script src="${CDN}/tryon.js" data-key="${shopInfo.apiKey}" defer></script>`
    : ''

  const shopifySnippet = shopInfo
    ? `{% comment %} TryOn Widget {% endcomment %}
<script src="${CDN}/tryon.js" data-key="${shopInfo.apiKey}" defer></script>`
    : ''

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Install Widget</h1>
        <p className="text-sm text-gray-500 mt-1">Add one line of code to your website</p>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <>
          {/* ── API Key ─────────────────────────────────────────── */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Your API Key</h2>
              <button onClick={handleRegenerate} disabled={regen}
                className="text-xs text-red-600 hover:underline disabled:opacity-50">
                {regen ? 'Regenerating...' : '↻ Regenerate'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm font-mono text-gray-700 truncate">
                {shopInfo?.apiKey}
              </code>
              <button onClick={() => copy(shopInfo.apiKey, 'key')}
                className="btn-secondary shrink-0">
                {copied === 'key' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Keep this private — it links usage to your account.</p>
          </div>

          {/* ── Basic embed ──────────────────────────────────────── */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-1">Embed Code</h2>
            <p className="text-sm text-gray-500 mb-4">
              Paste this into your website's <code className="bg-gray-100 px-1 rounded">&lt;head&gt;</code> or before the closing <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag.
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 rounded-xl p-5 text-sm overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {scriptTag}
              </pre>
              <button
                onClick={() => copy(scriptTag, 'embed')}
                className="absolute top-3 right-3 bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors">
                {copied === 'embed' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* ── Shopify ──────────────────────────────────────────── */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-1">Shopify</h2>
            <p className="text-sm text-gray-500 mb-4">
              Go to <strong>Online Store → Themes → Edit code → theme.liquid</strong> and paste before <code className="bg-gray-100 px-1 rounded">&lt;/head&gt;</code>
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-400 rounded-xl p-5 text-sm overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {shopifySnippet}
              </pre>
              <button
                onClick={() => copy(shopifySnippet, 'shopify')}
                className="absolute top-3 right-3 bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-600 transition-colors">
                {copied === 'shopify' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* ── WordPress/WooCommerce ────────────────────────────── */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-1">WordPress / WooCommerce</h2>
            <p className="text-sm text-gray-500 mb-3">
              Install the <strong>Insert Headers and Footers</strong> plugin, then paste the embed code into the <em>Header Scripts</em> box.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
              <p>1. Install plugin: <strong>Insert Headers and Footers</strong></p>
              <p>2. Go to Settings → Insert Headers and Footers</p>
              <p>3. Paste embed code in <em>"Scripts in Header"</em></p>
              <p>4. Click Save</p>
            </div>
          </div>

          {/* ── Test ─────────────────────────────────────────────── */}
          <div className="card border-indigo-200 bg-indigo-50">
            <h2 className="font-semibold text-indigo-900 mb-2">🧪 Test the widget</h2>
            <p className="text-sm text-indigo-700 mb-3">
              After installing, visit your website. You should see a "Try On" button in the bottom-right corner.
            </p>
            <p className="text-sm text-indigo-700">
              <strong>Troubleshooting:</strong> Open browser DevTools → Console. Any errors will appear there.
              Make sure you've uploaded at least one frame in the Frames section.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
