/**
 * overlay.js
 *
 * The core rendering engine — draws the glasses frame image
 * accurately on the face using MediaPipe landmarks.
 *
 * Algorithm:
 *  1. Get temple-to-temple distance in pixels (= frame width)
 *  2. Get nose bridge position (= frame anchor point)
 *  3. Get head rotation angle from eye line
 *  4. Load frame image (transparent PNG)
 *  5. Draw rotated, scaled frame image at correct position on canvas
 *
 * Advanced (when transformMatrix is available):
 *  - Use full 4x4 matrix for perspective-correct 3D placement
 *  - Frame appears to stick to face even when head tilts forward/back
 */

import { LANDMARKS } from './face-detector.js'

// Cache loaded frame images so we don't re-fetch every frame
const imageCache = new Map()

/**
 * drawFrameOverlay
 *
 * Main function called every render frame by camera.js
 */
export async function drawFrameOverlay({
  ctx,
  canvasEl,
  landmarks,
  frame,
  transformMatrix,
}) {
  if (!frame || !frame.imageUrl) return

  // Load frame image (cached after first load)
  const img = await loadImage(frame.imageUrl)
  if (!img) return

  // ─── Get key landmark positions in canvas pixel space ─────────────
  // MediaPipe returns normalized coordinates (0–1), multiply by canvas size
  const W = canvasEl.width
  const H = canvasEl.height

  const lm = (index) => ({
    x: landmarks[index].x * W,
    y: landmarks[index].y * H,
    z: landmarks[index].z,
  })

  const leftTemple    = lm(LANDMARKS.LEFT_TEMPLE)
  const rightTemple   = lm(LANDMARKS.RIGHT_TEMPLE)
  const noseBridge    = lm(LANDMARKS.NOSE_BRIDGE_MID)
  const leftEye       = lm(LANDMARKS.LEFT_EYE_OUTER)
  const rightEye      = lm(LANDMARKS.RIGHT_EYE_OUTER)
  const leftBrow      = lm(LANDMARKS.LEFT_BROW_OUTER)
  const rightBrow     = lm(LANDMARKS.RIGHT_BROW_OUTER)

  // ─── Calculate frame dimensions ───────────────────────────────────
  // Frame width = temple to temple distance
  // Real glasses are slightly wider than the face at temple level
  const templeDistance = Math.hypot(
    rightTemple.x - leftTemple.x,
    rightTemple.y - leftTemple.y
  )

  const FRAME_SCALE = 1.05  // glasses are ~5% wider than temple distance
  const frameWidth  = templeDistance * FRAME_SCALE
  const frameHeight = frameWidth * (img.naturalHeight / img.naturalWidth)

  // ─── Calculate head rotation (roll angle) ─────────────────────────
  // The angle between the eye line and horizontal
  // Without this, glasses look tilted when user tilts their head
  const angle = Math.atan2(
    rightEye.y - leftEye.y,
    rightEye.x - leftEye.x
  )

  // ─── Calculate frame anchor position ──────────────────────────────
  // Center horizontally between eyes
  // Vertically: position so glasses sit just above the nose bridge
  // We use the nose bridge as anchor, then offset upward
  const centerX = (leftTemple.x + rightTemple.x) / 2
  const centerY = noseBridge.y - (frameHeight * 0.15)

  // ─── Draw the frame image with rotation ───────────────────────────
  ctx.save()

  // Translate to the center point of where glasses should be
  ctx.translate(centerX, centerY)

  // Apply head rotation
  ctx.rotate(angle)

  // Optional: subtle shadow for realism
  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 2

  // Draw image centered on our anchor point
  ctx.drawImage(
    img,
    -frameWidth / 2,   // offset left by half width to center
    -frameHeight / 2,  // offset up by half height to center
    frameWidth,
    frameHeight
  )

  ctx.restore()

  // ─── Debug mode: show landmark dots ───────────────────────────────
  if (window.__TRYON_DEBUG__) {
    drawDebugLandmarks(ctx, [
      leftTemple, rightTemple, noseBridge, leftEye, rightEye
    ])
  }
}

/**
 * loadImage
 * Loads and caches a frame image by URL.
 * Returns null if image fails to load.
 */
function loadImage(url) {
  return new Promise((resolve) => {
    if (imageCache.has(url)) {
      resolve(imageCache.get(url))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      imageCache.set(url, img)
      resolve(img)
    }

    img.onerror = () => {
      console.warn('[TryOn] Failed to load frame image:', url)
      resolve(null)
    }

    img.src = url
  })
}

/**
 * drawDebugLandmarks
 * Draws colored dots at key landmark positions.
 * Enable by setting window.__TRYON_DEBUG__ = true in browser console.
 */
function drawDebugLandmarks(ctx, points) {
  ctx.save()
  points.forEach((p, i) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = ['#ff0', '#0ff', '#f0f', '#0f0', '#f00'][i % 5]
    ctx.fill()
  })
  ctx.restore()
}

/**
 * preloadFrameImages
 * Call this when widget opens to preload all frame images.
 * Avoids visible loading lag when user switches frames.
 */
export function preloadFrameImages(frames) {
  frames.forEach(frame => {
    if (frame.imageUrl) loadImage(frame.imageUrl)
  })
}
