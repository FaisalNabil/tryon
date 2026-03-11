'use client'

import { useEffect, useRef, useState } from 'react'
import { frames as framesApi } from '../../../lib/api'

const STYLES = ['rectangular','round','cat_eye','aviator','square','geometric','other']

export default function FramesPage() {
  const [frameList, setFrameList] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [dragOver,  setDragOver]  = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadFrames() }, [])

  async function loadFrames() {
    try {
      const frames = await framesApi.list()
      setFrameList(frames)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(files) {
    if (!files?.length) return
    setUploading(true)
    setError('')

    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('image', file)
        fd.append('name',  file.name.replace(/\.[^.]+$/, ''))
        await framesApi.upload(fd)
        flash('✅ Frame uploaded!')
      } catch (err) {
        setError(err.message)
      }
    }

    setUploading(false)
    loadFrames()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this frame?')) return
    try {
      await framesApi.delete(id)
      setFrameList(prev => prev.filter(f => f.id !== id))
      flash('Frame deleted')
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleToggle(frame) {
    try {
      const updated = await framesApi.update(frame.id, { isActive: !frame.isActive })
      setFrameList(prev => prev.map(f => f.id === frame.id ? updated : f))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStyleChange(frame, style) {
    try {
      const updated = await framesApi.update(frame.id, { style })
      setFrameList(prev => prev.map(f => f.id === frame.id ? updated : f))
    } catch {}
  }

  function flash(msg) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Frames</h1>
          <p className="text-sm text-gray-500 mt-1">Upload transparent PNG images of your glasses</p>
        </div>
        <button className="btn-primary" onClick={() => fileRef.current?.click()}>
          + Upload frames
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleUpload(e.target.files)} />
      </div>

      {error   && <div className="bg-red-50 text-red-700 text-sm p-4 rounded-lg border border-red-100">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg border border-green-100">{success}</div>}

      {/* ── Drop zone ─────────────────────────────────────────────── */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Uploading and removing background...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl">👓</span>
            <p className="text-sm font-medium text-gray-700">Drop glasses images here, or click to browse</p>
            <p className="text-xs text-gray-400">PNG, JPG or WebP · Max 5MB · Background auto-removed</p>
          </div>
        )}
      </div>

      {/* ── Frame grid ────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading frames...</div>
      ) : frameList.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>No frames uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {frameList.map(frame => (
            <FrameCard
              key={frame.id}
              frame={frame}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onStyleChange={handleStyleChange}
            />
          ))}
        </div>
      )}

    </div>
  )
}

function FrameCard({ frame, onDelete, onToggle, onStyleChange }) {
  return (
    <div className={`card flex flex-col gap-3 ${!frame.isActive ? 'opacity-60' : ''}`}>

      {/* Image preview */}
      <div className="bg-gray-50 rounded-lg h-24 flex items-center justify-center border">
        <img src={frame.imageUrl} alt={frame.name}
          className="max-h-20 max-w-full object-contain" />
      </div>

      {/* Name */}
      <p className="font-medium text-sm text-gray-900 truncate">{frame.name}</p>

      {/* Style tag */}
      <select
        value={frame.style || ''}
        onChange={e => onStyleChange(frame, e.target.value || null)}
        className="input text-xs py-1"
      >
        <option value="">— No style tag —</option>
        {STYLES.map(s => (
          <option key={s} value={s}>{s.replace('_', '-')}</option>
        ))}
      </select>

      {/* Product URL */}
      {frame.productUrl && (
        <p className="text-xs text-gray-400 truncate" title={frame.productUrl}>
          🔗 {frame.productUrl}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onToggle(frame)}
          className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${
            frame.isActive
              ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {frame.isActive ? '✓ Active' : 'Disabled'}
        </button>
        <button
          onClick={() => onDelete(frame.id)}
          className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete
        </button>
      </div>

    </div>
  )
}
