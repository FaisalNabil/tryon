/**
 * routes/ml.js — ML inference endpoints
 *
 * POST /v1/ml/fit-score       — Score a single face shape × frame style
 * POST /v1/ml/fit-score-batch — Score multiple frame styles at once
 *
 * Accepts both API key auth (widget) and JWT auth (dashboard).
 */

import { Router } from 'express'
import { requireApiKey } from '../middleware/apiKey.js'
import { requireAuth } from '../middleware/auth.js'
import { scoreFit, scoreAllStyles } from '../services/fitScorer.js'

const router = Router()

const VALID_FACE_SHAPES = ['oval', 'round', 'square', 'heart', 'oblong']
const VALID_FRAME_STYLES = ['rectangular', 'round', 'cat_eye', 'aviator', 'square', 'geometric', 'other']

// ─── Auth: accept either API key or JWT ─────────────────────────────
function flexAuth(req, res, next) {
  const hasApiKey = req.query.key || req.headers['x-api-key']
  if (hasApiKey) {
    return requireApiKey(req, res, next)
  }
  const hasBearer = req.headers.authorization?.startsWith('Bearer ')
  if (hasBearer) {
    return requireAuth(req, res, next)
  }
  return res.status(401).json({ error: 'Authentication required (API key or JWT)' })
}

// ─── POST /ml/fit-score ──────────────────────────────────────────────
// Score a single face shape × frame style pair.
//
// Body: { faceShape, frameStyle, faceRatios? }
// Returns: { score, label, method }
router.post('/fit-score', flexAuth, async (req, res, next) => {
  try {
    const { faceShape, frameStyle, faceRatios } = req.body

    if (!faceShape || !VALID_FACE_SHAPES.includes(faceShape)) {
      return res.status(400).json({
        error: `faceShape must be one of: ${VALID_FACE_SHAPES.join(', ')}`,
      })
    }

    if (!frameStyle || !VALID_FRAME_STYLES.includes(frameStyle)) {
      return res.status(400).json({
        error: `frameStyle must be one of: ${VALID_FRAME_STYLES.join(', ')}`,
      })
    }

    const result = await scoreFit({ faceShape, frameStyle, faceRatios })
    res.json(result)
  } catch (err) { next(err) }
})

// ─── POST /ml/fit-score-batch ────────────────────────────────────────
// Score multiple frame styles for a single face shape.
// Used by the widget to rank all frames after face detection.
//
// Body: { faceShape, frameStyles: string[], faceRatios? }
// Returns: { scores: [{ style, score, label, method }] }
router.post('/fit-score-batch', flexAuth, async (req, res, next) => {
  try {
    const { faceShape, frameStyles, faceRatios } = req.body

    if (!faceShape || !VALID_FACE_SHAPES.includes(faceShape)) {
      return res.status(400).json({
        error: `faceShape must be one of: ${VALID_FACE_SHAPES.join(', ')}`,
      })
    }

    if (!Array.isArray(frameStyles) || frameStyles.length === 0) {
      return res.status(400).json({ error: 'frameStyles array is required' })
    }

    // Filter valid styles, limit to 50
    const validStyles = frameStyles
      .filter(s => VALID_FRAME_STYLES.includes(s))
      .slice(0, 50)

    const scores = await scoreAllStyles({
      faceShape,
      frameStyles: validStyles,
      faceRatios,
    })

    res.json({ scores })
  } catch (err) { next(err) }
})

export default router
