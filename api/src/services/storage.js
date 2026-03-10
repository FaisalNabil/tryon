/**
 * services/storage.js — Cloudflare R2 file storage
 *
 * Handles uploading and deleting frame images in R2.
 * TODO (Milestone 5): Wire into frame upload route.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME

/**
 * Upload an image buffer to R2.
 * @param {Buffer} buffer - Image data
 * @param {string} key - Storage key (e.g. "frames/shop123/frame456.png")
 * @param {string} [contentType='image/png']
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadImage(buffer, key, contentType = 'image/png') {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))

  // R2 public URL pattern (configure custom domain or use R2.dev)
  return `${process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT}/${BUCKET}/${key}`
}

/**
 * Delete an image from R2.
 * @param {string} key - Storage key to delete
 */
export async function deleteImage(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }))
}
