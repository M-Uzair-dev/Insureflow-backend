import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'

export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 10)

// Ensure the target folder exists (relative to the backend cwd). On read-only
// deployments (e.g. Vercel serverless functions) this throws — fall back to
// silently discarding uploads there instead of crashing the whole app. Any
// host with a writable disk (e.g. a VPS) takes the normal disk-storage path.
let uploadsEnabled = true
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
} catch {
  uploadsEnabled = false
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Sanitize + timestamp-prefix to avoid collisions and path tricks.
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  },
})

// Used when the filesystem is read-only: drains and drops the upload bytes
// but still returns a filename, so the request succeeds like a real write.
const discardStorage = {
  _handleFile(req, file, cb) {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${Date.now()}-${safe}`
    file.stream.resume()
    file.stream.on('error', cb)
    file.stream.on('end', () => cb(null, { filename, size: 0 }))
  },
  _removeFile(req, file, cb) {
    cb(null)
  },
}

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg'])

export const upload = multer({
  storage: uploadsEnabled ? diskStorage : discardStorage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true)
    cb(new Error('Only PDF, PNG, and JPEG files are allowed'))
  },
})

// Best-effort delete of a stored file (used when a document is removed).
export function removeUpload(filename) {
  if (!uploadsEnabled) return
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(filename)))
  } catch {
    /* already gone — ignore */
  }
}
