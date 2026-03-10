/**
 * face-detector.js
 *
 * Wraps MediaPipe FaceLandmarker.
 * Loaded lazily — only when user opens the widget.
 *
 * MediaPipe gives us:
 *   - 478 3D face landmarks
 *   - Head pose transformation matrix (for 3D rotation)
 *   - Runs entirely in the browser via WebAssembly
 *   - No data sent to any server
 *   - Free, open source (Apache 2.0)
 *
 * Docs: https://developers.google.com/mediapipe/solutions/vision/face_landmarker
 */

import {
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision'

let faceLandmarker = null
let lastVideoTime = -1

/**
 * loadFaceDetector
 * Downloads the MediaPipe WASM binary and model file.
 * Called once when camera starts — cached after first load.
 */
export async function loadFaceDetector() {
  if (faceLandmarker) return // already loaded

  // FilesetResolver downloads the WASM files from the MediaPipe CDN
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  )

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      // The face landmark model — downloaded once, ~3MB
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU', // Use GPU if available, fallback to CPU
    },
    outputFaceBlendshapes: false,       // we don't need expression data
    outputFacialTransformationMatrixes: true, // we DO need 3D pose matrix
    runningMode: 'VIDEO',               // continuous video mode
    numFaces: 1,                        // only track one face at a time
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
}

/**
 * detectFace
 * Runs face landmark detection on the current video frame.
 * Returns null if no face is detected.
 *
 * IMPORTANT: MediaPipe VIDEO mode requires timestamps to increment.
 * We skip frames where the timestamp hasn't changed (no new video frame).
 */
export function detectFace(videoEl) {
  if (!faceLandmarker) return null
  if (videoEl.readyState < 2) return null

  const now = performance.now()

  // Only process if we have a new video frame
  if (videoEl.currentTime === lastVideoTime) return null
  lastVideoTime = videoEl.currentTime

  const result = faceLandmarker.detectForVideo(videoEl, now)

  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null
  }

  return result
}

/**
 * Landmark index reference — key points used by overlay.js
 *
 * MediaPipe Face Mesh uses 478 landmarks (468 face + 10 iris)
 * These are the ones we care about for glasses placement:
 */
export const LANDMARKS = {
  // Nose bridge — where glasses rest on the nose
  NOSE_BRIDGE_TOP:    6,
  NOSE_BRIDGE_MID:    168,
  NOSE_TIP:           4,

  // Left temple — where left arm of glasses meets face
  LEFT_TEMPLE:        234,
  // Right temple
  RIGHT_TEMPLE:       454,

  // Eye corners — for centering frame horizontally
  LEFT_EYE_OUTER:     33,
  LEFT_EYE_INNER:     133,
  RIGHT_EYE_INNER:    362,
  RIGHT_EYE_OUTER:    263,

  // Eye centers (approximate)
  LEFT_EYE_CENTER:    468,  // iris center (only in FaceLandmarker, not FaceMesh)
  RIGHT_EYE_CENTER:   473,

  // Eyebrows — top of glasses frame aligns here
  LEFT_BROW_OUTER:    70,
  RIGHT_BROW_OUTER:   300,
  LEFT_BROW_INNER:    107,
  RIGHT_BROW_INNER:   336,

  // Face shape measurements
  LEFT_CHEEK:         234,
  RIGHT_CHEEK:        454,
  CHIN:               152,
  TOP_HEAD:           10,
  LEFT_JAW:           172,
  RIGHT_JAW:          397,
  LEFT_FOREHEAD:      70,
  RIGHT_FOREHEAD:     300,
}
