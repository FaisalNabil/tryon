/**
 * services/fitScorer.js — Face shape × Frame style fit scoring
 *
 * Rule-based scorer that maps face shapes to recommended frame styles.
 * Returns a 0–100 score for how well a frame style suits a face shape.
 *
 * When a trained ONNX model exists, loads it via onnxruntime-node and
 * uses ML predictions instead of heuristics.
 *
 * Rule sources: standard optician fitting guidelines.
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ─── Rule-based scoring matrix ──────────────────────────────────────
// Each face shape maps to styles with their base fit score.
// Styles not listed get a default neutral score of 50.
const FIT_RULES = {
  oval: {
    // Oval faces suit almost every style
    rectangular: 85, round: 85, cat_eye: 90, aviator: 90,
    square: 85, geometric: 80, other: 75,
  },
  round: {
    // Angular frames add contrast to soft curves
    rectangular: 90, square: 85, geometric: 85,
    cat_eye: 70, aviator: 60, round: 40, other: 55,
  },
  square: {
    // Curved frames soften strong jawlines
    round: 90, cat_eye: 85, aviator: 85,
    geometric: 60, rectangular: 45, square: 40, other: 55,
  },
  heart: {
    // Bottom-heavy frames balance a wider forehead
    aviator: 90, round: 85, cat_eye: 80,
    geometric: 65, rectangular: 55, square: 50, other: 55,
  },
  oblong: {
    // Wide or round frames add width to a long face
    round: 90, aviator: 85, square: 80,
    cat_eye: 70, geometric: 70, rectangular: 55, other: 55,
  },
}

const DEFAULT_SCORE = 50

// ─── ONNX model (lazy-loaded) ───────────────────────────────────────
let onnxSession = null
let onnxFeatures = null
let onnxLoadAttempted = false

const MODELS_DIR = join(process.cwd(), 'ml-models')
const VERSION_FILE = join(MODELS_DIR, 'current_version.txt')

async function loadOnnxModel() {
  if (onnxLoadAttempted) return !!onnxSession
  onnxLoadAttempted = true

  try {
    if (!existsSync(VERSION_FILE)) return false

    const version = readFileSync(VERSION_FILE, 'utf-8').trim()
    const modelPath = join(MODELS_DIR, `fit_scorer_${version}.onnx`)
    const featuresPath = join(MODELS_DIR, `fit_scorer_${version}_features.json`)

    if (!existsSync(modelPath) || !existsSync(featuresPath)) return false

    // Dynamic import — only loads onnxruntime-node when model exists
    const ort = await import('onnxruntime-node')
    onnxSession = await ort.InferenceSession.create(modelPath)
    onnxFeatures = JSON.parse(readFileSync(featuresPath, 'utf-8'))

    console.log(`[FitScorer] Loaded ONNX model v${version} (${onnxFeatures.length} features)`)
    return true
  } catch (err) {
    console.warn('[FitScorer] ONNX model not available, using rules:', err.message)
    return false
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Score how well a frame style fits a face shape.
 *
 * @param {object} params
 * @param {string} params.faceShape - One of: oval, round, square, heart, oblong
 * @param {string} params.frameStyle - One of: rectangular, round, cat_eye, aviator, square, geometric, other
 * @param {object} [params.faceRatios] - { widthToLength, jawToCheekbone, foreheadToJaw }
 * @returns {Promise<{ score: number, label: string, method: string }>}
 */
export async function scoreFit({ faceShape, frameStyle, faceRatios }) {
  // Try ONNX model first (if available)
  const hasModel = await loadOnnxModel()

  if (hasModel && onnxSession && faceRatios) {
    try {
      const score = await scoreWithOnnx({ faceShape, frameStyle, faceRatios })
      return {
        score,
        label: getLabel(score),
        method: 'ml',
      }
    } catch (err) {
      console.warn('[FitScorer] ONNX inference failed, falling back to rules:', err.message)
    }
  }

  // Fallback: rule-based scoring
  const score = scoreWithRules(faceShape, frameStyle)
  return {
    score,
    label: getLabel(score),
    method: 'rules',
  }
}

/**
 * Score all frame styles for a given face shape.
 * Useful for ranking frames in the widget.
 *
 * @param {object} params
 * @param {string} params.faceShape
 * @param {string[]} params.frameStyles - Array of style strings
 * @param {object} [params.faceRatios]
 * @returns {Promise<Array<{ style: string, score: number, label: string }>>}
 */
export async function scoreAllStyles({ faceShape, frameStyles, faceRatios }) {
  const results = await Promise.all(
    frameStyles.map(async (style) => {
      const { score, label, method } = await scoreFit({
        faceShape,
        frameStyle: style,
        faceRatios,
      })
      return { style, score, label, method }
    })
  )

  // Sort best fits first
  return results.sort((a, b) => b.score - a.score)
}

// ─── Internal: Rule-based scorer ────────────────────────────────────
function scoreWithRules(faceShape, frameStyle) {
  const shapeRules = FIT_RULES[faceShape]
  if (!shapeRules) return DEFAULT_SCORE
  return shapeRules[frameStyle] ?? DEFAULT_SCORE
}

// ─── Internal: ONNX model scorer ────────────────────────────────────
async function scoreWithOnnx({ faceShape, frameStyle, faceRatios }) {
  // Build feature vector matching the training script's column order
  const featureMap = {
    'face_width_to_length':  faceRatios.widthToLength || 0.75,
    'face_jaw_to_cheekbone': faceRatios.jawToCheekbone || 0.90,
    'face_forehead_to_jaw':  faceRatios.foreheadToJaw || 1.00,
    'face_shape_oval':    faceShape === 'oval' ? 1 : 0,
    'face_shape_round':   faceShape === 'round' ? 1 : 0,
    'face_shape_square':  faceShape === 'square' ? 1 : 0,
    'face_shape_heart':   faceShape === 'heart' ? 1 : 0,
    'face_shape_oblong':  faceShape === 'oblong' ? 1 : 0,
    'style_rectangular':  frameStyle === 'rectangular' ? 1 : 0,
    'style_round':        frameStyle === 'round' ? 1 : 0,
    'style_cat_eye':      frameStyle === 'cat_eye' ? 1 : 0,
    'style_aviator':      frameStyle === 'aviator' ? 1 : 0,
    'style_square':       frameStyle === 'square' ? 1 : 0,
    'style_geometric':    frameStyle === 'geometric' ? 1 : 0,
    'was_adjusted':       0,
    'avg_offset_x':       0,
  }

  // Build feature array in exact training order
  const featureArray = onnxFeatures.map(name => featureMap[name] ?? 0)

  const ort = await import('onnxruntime-node')
  const tensor = new ort.Tensor('float32', Float32Array.from(featureArray), [1, featureArray.length])
  const feeds = { features: tensor }

  const results = await onnxSession.run(feeds)

  // GradientBoosting output: probabilities [class_0, class_1]
  // class_1 = probability of conversion → map to 0-100 score
  const outputName = onnxSession.outputNames.find(n => n.includes('probabilities')) || onnxSession.outputNames[1] || onnxSession.outputNames[0]
  const probs = results[outputName].data

  // Convert conversion probability to a fit score (0-100)
  // Scale: prob is typically 0.0–0.3 for this kind of data, normalize to 0-100
  const rawProb = probs.length > 1 ? probs[1] : probs[0]
  return Math.round(Math.min(100, Math.max(0, rawProb * 250)))
}

// ─── Label mapping ──────────────────────────────────────────────────
function getLabel(score) {
  if (score >= 85) return 'Great fit'
  if (score >= 70) return 'Good fit'
  if (score >= 55) return 'Decent fit'
  return 'Not ideal'
}
