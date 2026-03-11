/**
 * routes/frames.js — Frame CRUD
 *
 * Manage eyeglass frame images for a shop.
 * Upload processing (R2, rembg) is wired in Milestone 5.
 */

import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../server.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB

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
router.post('/upload', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' })
    }

    const { name, style } = req.body

    // TODO (Milestone 5): Process through rembg, upload to R2
    // For now, store a placeholder URL
    const imageUrl = `placeholder://${req.file.originalname}`

    const frame = await prisma.frame.create({
      data: {
        shopId: req.shopId,
        name: name || req.file.originalname.replace(/\.\w+$/, ''),
        style: style || 'other',
        imageUrl,
      },
    })

    res.status(201).json(frame)
  } catch (err) { next(err) }
})

// ─── PUT /:id — Update frame metadata ──────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { name, style, isActive } = req.body

    const frame = await prisma.frame.updateMany({
      where: { id: req.params.id, shopId: req.shopId },
      data: {
        ...(name     !== undefined && { name }),
        ...(style    !== undefined && { style }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    if (frame.count === 0) {
      return res.status(404).json({ error: 'Frame not found' })
    }

    const updated = await prisma.frame.findUnique({ where: { id: req.params.id } })
    res.json(updated)
  } catch (err) { next(err) }
})

// ─── DELETE /:id — Delete a frame ───────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    // TODO (Milestone 5): Also delete image from R2
    const result = await prisma.frame.deleteMany({
      where: { id: req.params.id, shopId: req.shopId },
    })

    if (result.count === 0) {
      return res.status(404).json({ error: 'Frame not found' })
    }

    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
