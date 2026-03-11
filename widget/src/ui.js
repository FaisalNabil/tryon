/**
 * ui.js
 *
 * Injects all DOM elements into the shop owner's page:
 *   1. A floating "Try On" button (bottom-right by default)
 *   2. A fullscreen modal with the camera + canvas overlay
 *
 * Uses Shadow DOM to isolate styles from the host page.
 * This ensures the widget looks correct on ANY website.
 */

import { startCamera, stopCamera, setActiveFrame } from './camera.js'
import { trackEvent } from './analytics.js'
import { preloadFrameImages } from './overlay.js'

let shadowRoot = null
let config = null

export function mountButton(shopConfig) {
  config = shopConfig

  // ─── Create a host element with Shadow DOM ────────────────────────
  // Shadow DOM = our styles never conflict with the shop's CSS
  const host = document.createElement('div')
  host.id = 'tryon-widget-host'
  shadowRoot = host.attachShadow({ mode: 'open' })

  // ─── Inject styles ────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = getStyles(config)
  shadowRoot.appendChild(style)

  // ─── Floating button ──────────────────────────────────────────────
  const button = document.createElement('button')
  button.id = 'tryon-btn'
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    </svg>
    <span>${config.buttonText || 'Try On'}</span>
  `
  button.addEventListener('click', openModal)
  shadowRoot.appendChild(button)

  // ─── Modal (hidden by default) ────────────────────────────────────
  const modal = createModal()
  shadowRoot.appendChild(modal)

  // ─── Attach host to page ──────────────────────────────────────────
  document.body.appendChild(host)
}

function createModal() {
  const modal = document.createElement('div')
  modal.id = 'tryon-modal'
  modal.setAttribute('aria-hidden', 'true')
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-label', 'Virtual Try-On')

  modal.innerHTML = `
    <div id="tryon-modal-inner">

      <!-- Header -->
      <div id="tryon-header">
        <span id="tryon-title">Virtual Try-On</span>
        <button id="tryon-close" aria-label="Close try-on">✕</button>
      </div>

      <!-- Camera area -->
      <div id="tryon-camera-area">
        <!-- Video feed (hidden, used as source) -->
        <video id="tryon-video" autoplay playsinline muted></video>

        <!-- Canvas draws video + overlays frame on top -->
        <canvas id="tryon-canvas"></canvas>

        <!-- Shown while camera is loading -->
        <div id="tryon-loading">
          <div class="spinner"></div>
          <p>Starting camera...</p>
        </div>

        <!-- Shown if no face detected -->
        <div id="tryon-no-face" hidden>
          <p>📷 Position your face in the center</p>
        </div>

        <!-- Shown if camera permission denied -->
        <div id="tryon-no-permission" hidden>
          <p>🚫 Camera access denied</p>
          <p>Please allow camera access in your browser settings to use Try-On.</p>
        </div>
      </div>

      <!-- Frame selector -->
      <div id="tryon-frames">
        <p id="tryon-frames-label">Select a frame:</p>
        <div id="tryon-frames-list"></div>
      </div>

      <!-- Recommendation label (shown after face shape detected) -->
      <div id="tryon-recommendation" hidden>
        <span id="tryon-rec-text"></span>
      </div>

    </div>
  `

  // Wire up close button
  modal.querySelector('#tryon-close').addEventListener('click', closeModal)

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal()
  })

  return modal
}

async function openModal() {
  trackEvent('widget_open')

  const modal = shadowRoot.getElementById('tryon-modal')
  modal.removeAttribute('aria-hidden')
  modal.classList.add('open')
  document.body.style.overflow = 'hidden' // prevent background scroll

  // Populate frames list and preload frame images for instant switching
  populateFrames()
  preloadFrameImages(config.frames || [])

  // Start camera + face detection
  try {
    await startCamera({
      videoEl: shadowRoot.getElementById('tryon-video'),
      canvasEl: shadowRoot.getElementById('tryon-canvas'),
      loadingEl: shadowRoot.getElementById('tryon-loading'),
      noFaceEl: shadowRoot.getElementById('tryon-no-face'),
      frames: config.frames,
      onFaceShapeDetected: (shape) => showRecommendation(shape),
    })
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      showPermissionError()
    } else {
      console.warn('[TryOn] Camera error:', err)
    }
  }
}

function closeModal() {
  const modal = shadowRoot.getElementById('tryon-modal')
  modal.setAttribute('aria-hidden', 'true')
  modal.classList.remove('open')
  document.body.style.overflow = ''
  stopCamera()
}

function populateFrames() {
  const list = shadowRoot.getElementById('tryon-frames-list')
  list.innerHTML = ''

  if (!config.frames || config.frames.length === 0) {
    list.innerHTML = '<p style="color:#999">No frames available</p>'
    return
  }

  config.frames.forEach((frame, index) => {
    const btn = document.createElement('button')
    btn.className = 'frame-btn'
    btn.dataset.frameId = frame.id
    if (index === 0) btn.classList.add('active')

    btn.innerHTML = `
      <img src="${frame.imageUrl}" alt="${frame.name}" />
      <span>${frame.name}</span>
    `
    btn.addEventListener('click', () => selectFrame(frame, btn))
    list.appendChild(btn)
  })

  // Auto-select first frame
  if (config.frames.length > 0) {
    selectFrame(config.frames[0], list.firstElementChild)
  }
}

function selectFrame(frame, btn) {
  // Deactivate all
  shadowRoot.querySelectorAll('.frame-btn').forEach(b => b.classList.remove('active'))
  btn.classList.add('active')

  // Tell camera module which frame to overlay
  setActiveFrame(frame)

  trackEvent('frame_tried', { frameId: frame.id })
}

async function showRecommendation(shape) {
  const el = shadowRoot.getElementById('tryon-recommendation')
  const text = shadowRoot.getElementById('tryon-rec-text')
  text.textContent = `Detected: ${shape} face shape`
  el.removeAttribute('hidden')

  // Fetch fit scores for all frames from the ML endpoint
  await fetchAndShowFitScores(shape)
}

/**
 * Call the batch fit-score endpoint and add badges to frame cards.
 */
async function fetchAndShowFitScores(faceShape) {
  if (!config?.frames?.length || !config._apiBase || !config._apiKey) return

  // Collect styles from frames (fall back to 'other' if not set)
  const frameStyles = config.frames.map(f => f.style || 'other')

  try {
    const res = await fetch(`${config._apiBase}/ml/fit-score-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config._apiKey,
      },
      body: JSON.stringify({ faceShape, frameStyles }),
    })

    if (!res.ok) return

    const { scores } = await res.json()
    if (!scores?.length) return

    // Map style → score result
    const scoreMap = {}
    scores.forEach(s => { scoreMap[s.style] = s })

    // Add badges to each frame button
    config.frames.forEach((frame) => {
      const style = frame.style || 'other'
      const scoreData = scoreMap[style]
      if (!scoreData) return

      const btn = shadowRoot.querySelector(`.frame-btn[data-frame-id="${frame.id}"]`)
      if (!btn) return

      // Remove existing badge if any
      const existing = btn.querySelector('.fit-badge')
      if (existing) existing.remove()

      const badge = document.createElement('span')
      badge.className = `fit-badge fit-${getBadgeClass(scoreData.score)}`
      badge.textContent = scoreData.label
      btn.appendChild(badge)
    })
  } catch (err) {
    console.warn('[TryOn] Fit scoring unavailable:', err.message)
  }
}

function getBadgeClass(score) {
  if (score >= 85) return 'great'
  if (score >= 70) return 'good'
  if (score >= 55) return 'decent'
  return 'low'
}

function showPermissionError() {
  shadowRoot.getElementById('tryon-loading').setAttribute('hidden', '')
  shadowRoot.getElementById('tryon-no-permission').removeAttribute('hidden')
}

function getStyles(cfg) {
  const btnColor = cfg.buttonColor || '#000000'
  const primaryColor = cfg.primaryColor || '#6366f1'
  const position = cfg.buttonPosition || 'bottom-right'

  const positionCSS = position === 'bottom-left'
    ? 'bottom: 24px; left: 24px;'
    : 'bottom: 24px; right: 24px;'

  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Floating Button ── */
    #tryon-btn {
      position: fixed;
      ${positionCSS}
      z-index: 999998;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: ${btnColor};
      color: #fff;
      border: none;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      font-family: system-ui, sans-serif;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #tryon-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
    }
    #tryon-btn:active { transform: translateY(0); }

    /* ── Modal Backdrop ── */
    #tryon-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0,0,0,0.7);
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
    }
    #tryon-modal.open { display: flex; }

    /* ── Modal Inner ── */
    #tryon-modal-inner {
      background: #fff;
      border-radius: 16px;
      width: min(480px, calc(100vw - 32px));
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }

    /* ── Header ── */
    #tryon-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #eee;
    }
    #tryon-title {
      font-size: 16px;
      font-weight: 700;
      color: #111;
    }
    #tryon-close {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 4px 8px;
      border-radius: 4px;
    }
    #tryon-close:hover { background: #f0f0f0; }

    /* ── Camera Area ── */
    #tryon-camera-area {
      position: relative;
      width: 100%;
      aspect-ratio: 4/3;
      background: #111;
      overflow: hidden;
    }
    #tryon-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1); /* mirror so user sees themselves */
    }
    #tryon-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      transform: scaleX(-1); /* mirror canvas too */
    }
    #tryon-loading, #tryon-no-face, #tryon-no-permission {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #fff;
      font-size: 14px;
      background: rgba(0,0,0,0.6);
      text-align: center;
      padding: 20px;
    }
    [hidden] { display: none !important; }

    /* Spinner */
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Frames Selector ── */
    #tryon-frames {
      padding: 16px 20px;
      border-top: 1px solid #eee;
    }
    #tryon-frames-label {
      font-size: 12px;
      color: #888;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #tryon-frames-list {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .frame-btn {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px;
      border: 2px solid #eee;
      border-radius: 10px;
      background: #fafafa;
      cursor: pointer;
      transition: border-color 0.15s;
      width: 80px;
    }
    .frame-btn:hover { border-color: ${primaryColor}; }
    .frame-btn.active { border-color: ${primaryColor}; background: #f5f3ff; }
    .frame-btn img {
      width: 56px;
      height: 30px;
      object-fit: contain;
    }
    .frame-btn span {
      font-size: 10px;
      color: #555;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 70px;
    }

    /* ── Fit Score Badges ── */
    .fit-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 8px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-top: 2px;
    }
    .fit-great { background: #dcfce7; color: #166534; }
    .fit-good  { background: #dbeafe; color: #1e40af; }
    .fit-decent { background: #fef9c3; color: #854d0e; }
    .fit-low   { background: #f3f4f6; color: #6b7280; }

    /* ── Recommendation ── */
    #tryon-recommendation {
      padding: 10px 20px;
      background: #f5f3ff;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: ${primaryColor};
      font-weight: 500;
    }
  `
}
