/**
 * bootstrap.js — API key validation and config fetching
 *
 * Calls the TryOn API to validate the shop's API key
 * and returns the widget configuration (frames, settings, branding).
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.tryonwidget.com/v1'

/**
 * Validate the API key and fetch the shop's widget config.
 * @param {string} apiKey - The shop's API key (tk_...)
 * @returns {Promise<object|null>} Shop config or null on failure
 */
export async function validateAndFetchConfig(apiKey) {
  try {
    const res = await fetch(`${API_BASE}/widget/config?key=${encodeURIComponent(apiKey)}`)

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.error('[TryOn] Invalid API key')
      } else {
        console.error(`[TryOn] Config fetch failed: ${res.status}`)
      }
      return null
    }

    const config = await res.json()

    // Attach API key + base URL to config for later use (analytics, etc.)
    config._apiKey  = apiKey
    config._apiBase = API_BASE

    return config
  } catch (err) {
    console.error('[TryOn] Network error fetching config:', err)
    return null
  }
}
