'use client'

import { useEffect, useState } from 'react'
import { shop as shopApi } from '../../../lib/api'

export default function SettingsPage() {
  const [form,    setForm]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { shop } = await shopApi.me()
      setForm({
        shopName:   shop.shopName   || '',
        websiteUrl: shop.websiteUrl || '',
        buttonColor:    shop.widgetSettings?.buttonColor    || '#000000',
        buttonPosition: shop.widgetSettings?.buttonPosition || 'bottom-right',
        buttonText:     shop.widgetSettings?.buttonText     || 'Try On',
        primaryColor:   shop.widgetSettings?.primaryColor   || '#6366f1',
        modalTitle:     shop.widgetSettings?.modalTitle     || 'Virtual Try-On',
      })
    } finally {
      setLoading(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const { shopName, websiteUrl, ...widgetSettings } = form
      await shopApi.update({ shopName, websiteUrl, widgetSettings })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return <div className="text-gray-400 py-12">Loading...</div>
  }

  return (
    <div className="space-y-8 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Customize your shop and widget appearance</p>
      </div>

      {error   && <div className="bg-red-50 text-red-700 text-sm p-4 rounded-lg border border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg border border-green-100">✓ Settings saved!</div>}

      <form onSubmit={handleSave} className="space-y-6">

        {/* Shop Info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Shop details</h2>

          <div>
            <label className="label">Shop name</label>
            <input type="text" className="input" value={form.shopName} onChange={set('shopName')} required />
          </div>

          <div>
            <label className="label">Website URL</label>
            <input type="url" className="input" value={form.websiteUrl} onChange={set('websiteUrl')} required />
            <p className="text-xs text-gray-400 mt-1">The widget API key only works on this domain.</p>
          </div>
        </div>

        {/* Widget Appearance */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-gray-900">Widget appearance</h2>

          {/* Button text */}
          <div>
            <label className="label">Button text</label>
            <input type="text" className="input" maxLength={30}
              value={form.buttonText} onChange={set('buttonText')} />
          </div>

          {/* Button position */}
          <div>
            <label className="label">Button position</label>
            <select className="input" value={form.buttonPosition} onChange={set('buttonPosition')}>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Button color</label>
              <div className="flex items-center gap-2">
                <input type="color" className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                  value={form.buttonColor} onChange={set('buttonColor')} />
                <input type="text" className="input font-mono text-sm"
                  value={form.buttonColor} onChange={set('buttonColor')}
                  pattern="^#[0-9a-fA-F]{6}$" />
              </div>
            </div>

            <div>
              <label className="label">Accent color</label>
              <div className="flex items-center gap-2">
                <input type="color" className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                  value={form.primaryColor} onChange={set('primaryColor')} />
                <input type="text" className="input font-mono text-sm"
                  value={form.primaryColor} onChange={set('primaryColor')}
                  pattern="^#[0-9a-fA-F]{6}$" />
              </div>
            </div>
          </div>

          {/* Modal title */}
          <div>
            <label className="label">Modal title</label>
            <input type="text" className="input" maxLength={60}
              value={form.modalTitle} onChange={set('modalTitle')} />
          </div>

          {/* Live preview */}
          <div>
            <label className="label">Preview</label>
            <div className="bg-gray-100 rounded-xl p-6 relative h-32 overflow-hidden">
              <p className="text-xs text-gray-400 mb-2">Your website content here...</p>
              <button
                type="button"
                style={{ background: form.buttonColor }}
                className="absolute bottom-4 right-4 text-white text-xs px-4 py-2 rounded-full font-medium shadow-lg flex items-center gap-2"
              >
                <span>👓</span>
                <span>{form.buttonText || 'Try On'}</span>
              </button>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>

      </form>
    </div>
  )
}
