/**
 * routes/frames.js — Frame CRUD
 *
 * Manage eyeglass frame images for a shop.
 * Upload pipeline: image → rembg (background removal) → R2 (CDN storage)
 */

import { Router } from 'express'
import { randomUUID } from 'crypto'
import multer from 'multer'
import { z } from 'zod'
import { prisma, redis } from '../server.js'
import { requireAuth } from '../middleware/auth.js'
import { removeBackground } from '../services/imageProcess.js'
import { uploadImage, deleteImage } from '../services/storage.js'

const router = Router()
router.use(requireAuth)

// ─── Validation schemas ───────────────────────────────────────────────
const VALID_STYLES = [
  'rectangular', 'round', 'cat_eye', 'aviator', 'square', 'geometric', 'other',
]

const frameUploadSchema = z.object({
  name:  z.string().min(1, 'Frame name is required').max(200).optional(),
  style: z.enum(VALID_STYLES, { message: `Style must be one of: ${VALID_STYLES.join(', ')}` }).optional(),
})

const frameUpdateSchema = z.object({
  name:     z.string().min(1).max(200).optional(),
  style:    z.enum(VALID_STYLES, { message: `Style must be one of: ${VALID_STYLES.join(', ')}` }).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field (name, style, isActive) is required',
})

// ─── Multer with file type filter ─────────────────────────────────────
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp']

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error('FILE_TYPE_NOT_ALLOWED')
      cb(err, false)
    }
  },
})

// ─── Helper: invalidate widget config cache ──────────────────────────
async function invalidateCache(shopId) {
  await redis.del(`widget:config:${shopId}`)
}

// ─── GET / — List all frames for this shop ──────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const frames = await prisma.frame.findMany({
      where: { shopId: req.shopId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(frames)
  } catch (err) { next(err) }
})

// ─── POST /upload — Upload a new frame image ────────────────────────
// Pipeline: receive image → remove background (rembg) → upload to R2 → save to DB
router.post('/upload', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' })
    }

    const { name, style } = frameUploadSchema.parse(req.body)

    // Step 1: Remove background via rembg microservice
    // Gracefully falls back to original image if rembg is unavailable
    let processedBuffer = req.file.buffer
    try {
      processedBuffer = await removeBackground(req.file.buffer)
    } catch (err) {
      console.warn('[frames] rembg unavailable, using original image:', err.message)
    }

    // Step 2: Upload to Cloudflare R2
    const key = `frames/${req.shopId}/${randomUUID()}.png`
    const imageUrl = await uploadImage(processedBuffer, key, 'image/png')

    // Step 3: Save frame record in database
    const frame = await prisma.frame.create({
      data: {
        shopId: req.shopId,
        name: name || req.file.originalname.replace(/\.\w+$/, ''),
        style: style || 'other',
        imageUrl,
      },
    })

    // Step 4: Invalidate widget config cache (new frame available)
    await invalidateCache(req.shopId)

    res.status(201).json(frame)
  } catch (err) { next(err) }
})

// ─── PUT /:id — Update frame metadata ──────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const data = frameUpdateSchema.parse(req.body)

    const frame = await prisma.frame.updateMany({
      where: { id: req.params.id, shopId: req.shopId },
      data,
    })

    if (frame.count === 0) {
      return res.status(404).json({ error: 'Frame not found' })
    }

    const updated = await prisma.frame.findUnique({ where: { id: req.params.id } })

    // Invalidate widget config cache (frame metadata changed)
    await invalidateCache(req.shopId)

    res.json(updated)
  } catch (err) { next(err) }
})

// ─── DELETE /:id — Delete a frame ───────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    // Fetch the frame first to get its R2 image URL
    const frame = await prisma.frame.findFirst({
      where: { id: req.params.id, shopId: req.shopId },
      select: { imageUrl: true },
    })

    if (!frame) {
      return res.status(404).json({ error: 'Frame not found' })
    }

    // Delete from R2 storage (non-blocking — DB deletion still happens if R2 fails)
    if (frame.imageUrl && !frame.imageUrl.startsWith('placeholder://')) {
      try {
        // Extract the R2 key from the full URL
        // URL format: https://.../{bucket}/{key} — key starts after bucket name
        const url = new URL(frame.imageUrl)
        const pathParts = url.pathname.split('/')
        // Key is everything after the bucket name segment (e.g. "frames/shopId/uuid.png")
        const bucketIdx = pathParts.findIndex(p => p === process.env.R2_BUCKET_NAME)
        const key = bucketIdx >= 0
          ? pathParts.slice(bucketIdx + 1).join('/')
          : pathParts.slice(1).join('/') // fallback: use full path
        await deleteImage(key)
      } catch (err) {
        console.warn('[frames] Failed to delete from R2:', err.message)
      }
    }

    // Delete from database
    await prisma.frame.deleteMany({
      where: { id: req.params.id, shopId: req.shopId },
    })

    // Invalidate widget config cache (frame removed)
    await invalidateCache(req.shopId)

    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
