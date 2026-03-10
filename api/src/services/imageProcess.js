/**
 * services/imageProcess.js — Background removal via rembg
 *
 * Calls the local rembg Python microservice to remove
 * the background from uploaded frame images.
 * TODO (Milestone 5): Wire into frame upload route.
 */

const REMBG_URL = process.env.REMBG_URL || 'http://localhost:5000'

/**
 * Remove background from an image.
 * @param {Buffer} imageBuffer - Original image data
 * @returns {Promise<Buffer>} Transparent PNG buffer
 */
export async function removeBackground(imageBuffer) {
  const formData = new FormData()
  formData.append('image', new Blob([imageBuffer]), 'frame.png')

  const res = await fetch(`${REMBG_URL}/remove-bg`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`rembg service error: ${res.status} ${await res.text()}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
