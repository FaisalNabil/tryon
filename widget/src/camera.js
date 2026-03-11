/**
 * camera.js
 *
 * Manages the webcam stream and the real-time render loop.
 * Each frame:
 *   1. Reads video frame
 *   2. Sends to MediaPipe FaceLandmarker
 *   3. Gets 468 landmarks back
 *   4. Calls overlay.js to draw the glasses frame
 *
 * Runs at ~30fps using requestAnimationFrame.
 */

import { loadFaceDetector, detectFace } from './face-detector.js'
import { drawFrameOverlay } from './overlay.js'
import { trackEvent } from './analytics.js'

let videoEl = null
let canvasEl = null
let ctx = null
let activeFrame = null
let animFrameId = null
let stream = null
let onFaceShapeCallback = null
let faceShapeReported = false
let loadingEl = null
let noFaceEl = null
let consecutiveNoFaceFrames = 0
const NO_FACE_THRESHOLD = 30 // ~1 second at 30fps

/**
 * startCamera — called when user opens the modal
 */
export async function startCamera({
  videoEl: _videoEl,
  canvasEl: _canvasEl,
  loadingEl: _loadingEl,
  noFaceEl: _noFaceEl,
  frames,
  onFaceShapeDetected,
}) {
  videoEl = _videoEl
  canvasEl = _canvasEl
  loadingEl = _loadingEl
  noFaceEl = _noFaceEl
  onFaceShapeCallback = onFaceShapeDetected
  faceShapeReported = false
  consecutiveNoFaceFrames = 0
  ctx = canvasEl.getContext('2d')

  // Auto-select first frame
  if (frames && frames.length > 0) {
    activeFrame = frames[0]
  }

  // ─── 1. Request camera access ────────────────────────────────────
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',     // front camera
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  })

  videoEl.srcObject = stream

  // Wait for video metadata to load so we know dimensions
  await new Promise((resolve) => {
    videoEl.onloadedmetadata = resolve
  })

  // Match canvas to video dimensions
  canvasEl.width = videoEl.videoWidth
  canvasEl.height = videoEl.videoHeight

  // ─── 2. Load MediaPipe FaceLandmarker model ───────────────────────
  await loadFaceDetector()

  // ─── 3. Hide loading spinner ──────────────────────────────────────
  if (loadingEl) loadingEl.setAttribute('hidden', '')

  // ─── 4. Start render loop ─────────────────────────────────────────
  renderLoop()
}

/**
 * stopCamera — called when modal closes
 */
export function stopCamera() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (ctx && canvasEl) {
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
  }
}

/**
 * setActiveFrame — called when user clicks a frame in the UI
 */
export function setActiveFrame(frame) {
  activeFrame = frame
  // Preload the frame image so there's no flicker on first render
  if (frame && frame.imageUrl) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = frame.imageUrl
  }
}

/**
 * renderLoop — runs every animation frame
 */
function renderLoop() {
  if (!videoEl || videoEl.readyState < 2) {
    animFrameId = requestAnimationFrame(renderLoop)
    return
  }

  // Clear canvas
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)

  // Draw current video frame onto canvas
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height)

  // Run face detection on current frame
  const result = detectFace(videoEl)

  if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
    consecutiveNoFaceFrames = 0

    // Hide "no face" message
    if (noFaceEl) noFaceEl.setAttribute('hidden', '')

    const landmarks = result.faceLandmarks[0] // first detected face

    // Draw the glasses overlay
    if (activeFrame) {
      drawFrameOverlay({
        ctx,
        canvasEl,
        landmarks,
        frame: activeFrame,
        transformMatrix: result.facialTransformationMatrixes?.[0],
      })
    }

    // Report face shape once per session (for recommendations + ML training)
    if (!faceShapeReported && onFaceShapeCallback) {
      const result = estimateFaceShapeFromLandmarks(landmarks)
      if (result) {
        faceShapeReported = true
        onFaceShapeCallback(result.shape)

        // Send face ratios to API for ML training data collection
        trackEvent('face_ratios', {
          faceShape: result.shape,
          ...result.ratios,
        })
      }
    }
  } else {
    consecutiveNoFaceFrames++

    // Show "position your face" message after 1 second of no face
    if (consecutiveNoFaceFrames > NO_FACE_THRESHOLD && noFaceEl) {
      noFaceEl.removeAttribute('hidden')
    }
  }

  animFrameId = requestAnimationFrame(renderLoop)
}

/**
 * estimateFaceShapeFromLandmarks
 *
 * Quick client-side face shape estimation using landmark ratios.
 * This is a fast approximation — the real model runs server-side.
 * Used for instant feedback while the server processes the image.
 *
 * Face shape heuristics based on facial width-to-length ratios:
 *   Oval:    faceRatio 0.70–0.80, jaw narrower than cheekbones
 *   Round:   faceRatio > 0.80, similar width and length
 *   Square:  strong jaw, similar forehead + jaw width
 *   Heart:   wide forehead, narrow jaw
 *   Oblong:  faceRatio < 0.65, long and narrow
 */
function estimateFaceShapeFromLandmarks(landmarks) {
  try {
    // Key landmark indices (normalized 0–1 coordinates)
    const leftCheek   = landmarks[234]
    const rightCheek  = landmarks[454]
    const topHead     = landmarks[10]
    const chin        = landmarks[152]
    const leftJaw     = landmarks[172]
    const rightJaw    = landmarks[397]
    const leftBrow    = landmarks[70]
    const rightBrow   = landmarks[300]

    const faceWidth   = Math.abs(rightCheek.x - leftCheek.x)
    const faceLength  = Math.abs(chin.y - topHead.y)
    const jawWidth    = Math.abs(rightJaw.x - leftJaw.x)
    const browWidth   = Math.abs(rightBrow.x - leftBrow.x)

    const widthToLength    = Math.round((faceWidth / faceLength) * 1000) / 1000
    const jawToCheekbone   = Math.round((jawWidth / faceWidth) * 1000) / 1000
    const foreheadToJaw    = Math.round((browWidth / faceWidth) * 1000) / 1000

    let shape
    if (widthToLength > 0.82) shape = 'round'
    else if (widthToLength < 0.65) shape = 'oblong'
    else if (foreheadToJaw > 0.85 && jawToCheekbone < 0.75) shape = 'heart'
    else if (jawToCheekbone > 0.85 && foreheadToJaw > 0.85) shape = 'square'
    else shape = 'oval' // most common default

    return { shape, ratios: { widthToLength, jawToCheekbone, foreheadToJaw } }
  } catch {
    return null
  }
}
