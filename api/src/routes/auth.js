/**
 * routes/auth.js — Registration and login
 *
 * POST /auth/register — Create a new shop account
 * POST /auth/login    — Authenticate and return JWT
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { prisma } from '../server.js'

const router = Router()

// ─── POST /register ─────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, shopName } = req.body

    if (!email || !password || !shopName) {
      return res.status(400).json({ error: 'email, password, and shopName are required' })
    }

    // Check if email already exists
    const existing = await prisma.shop.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    // Hash password and generate API key
    const passwordHash = await bcrypt.hash(password, 12)
    const apiKey = `tk_${crypto.randomBytes(24).toString('hex')}`

    const shop = await prisma.shop.create({
      data: {
        email,
        passwordHash,
        name: shopName,
        apiKey,
      },
    })

    const token = jwt.sign(
      { shopId: shop.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      token,
      shop: { id: shop.id, email: shop.email, name: shop.name, apiKey: shop.apiKey },
    })
  } catch (err) { next(err) }
})

// ─── POST /login ────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const shop = await prisma.shop.findUnique({ where: { email } })
    if (!shop) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, shop.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { shopId: shop.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      shop: { id: shop.id, email: shop.email, name: shop.name },
    })
  } catch (err) { next(err) }
})

export default router
