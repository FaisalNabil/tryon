/**
 * index.js — Widget entry point
 *
 * Auto-executes when the <script> tag loads.
 * Reads the API key from the data-key attribute,
 * validates it, fetches shop config, and mounts the UI.
 */

import { validateAndFetchConfig } from './bootstrap.js'
import { mountButton } from './ui.js'

;(async () => {
  try {
    // Find our own <script> tag to read the API key
    const scriptTag =
      document.currentScript ||
      document.querySelector('script[data-key]')

    if (!scriptTag) {
      console.error('[TryOn] No script tag found with data-key attribute')
      return
    }

    const apiKey = scriptTag.getAttribute('data-key')
    if (!apiKey) {
      console.error('[TryOn] Missing data-key attribute on script tag')
      return
    }

    // Validate key and fetch shop configuration
    const config = await validateAndFetchConfig(apiKey)
    if (!config) return

    // Mount the floating try-on button
    mountButton(config)
  } catch (err) {
    console.error('[TryOn] Failed to initialize:', err)
  }
})()
