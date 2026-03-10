/**
 * lib/api.js
 *
 * All API calls go through this module.
 * Handles: auth headers, base URL, error parsing, token refresh.
 */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1'

// ─── Core fetch wrapper ───────────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken()

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') window.location.href = '/login'
    throw new Error('Session expired')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`)
  }

  return data
}

// ─── Auth ─────────────────────────────────────────────────────────────
export const auth = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login:    (body) => request('/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
}

// ─── Shop ─────────────────────────────────────────────────────────────
export const shop = {
  me:            ()     => request('/shops/me'),
  update:        (body) => request('/shops/me', { method: 'PUT', body: JSON.stringify(body) }),
  regenerateKey: ()     => request('/shops/regenerate-key', { method: 'POST' }),
}

// ─── Frames ───────────────────────────────────────────────────────────
export const frames = {
  list:   ()       => request('/frames'),
  upload: (formData) => {
    // multipart — don't set Content-Type, let browser set boundary
    const token = getToken()
    return fetch(`${API}/frames/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      return data
    })
  },
  update: (id, body) => request(`/frames/${id}`, { method: 'PUT',  body: JSON.stringify(body) }),
  delete: (id)       => request(`/frames/${id}`, { method: 'DELETE' }),
}

// ─── Analytics ────────────────────────────────────────────────────────
export const analytics = {
  summary: (period = '7d') => request(`/analytics/summary?period=${period}`),
}

// ─── Billing ──────────────────────────────────────────────────────────
export const billing = {
  subscription:    ()      => request('/billing/subscription'),
  createCheckout:  (plan)  => request('/billing/create-checkout', { method: 'POST', body: JSON.stringify({ plan }) }),
  openPortal:      ()      => request('/billing/portal',          { method: 'POST' }),
}

// ─── Token helpers ────────────────────────────────────────────────────
export function saveToken(token) {
  if (typeof window !== 'undefined') localStorage.setItem('tryon_token', token)
}

export function getToken() {
  if (typeof window !== 'undefined') return localStorage.getItem('tryon_token')
  return null
}

export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('tryon_token')
}
