import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'

export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 10)

// Ensure the target folder exists (relative to the backend cwd).
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Sanitize + timestamp-prefix to avoid collisions and path tricks.
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  },
})

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg'])

export const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true)
    cb(new Error('Only PDF, PNG, and JPEG files are allowed'))
  },
})

// Best-effort delete of a stored file (used when a document is removed).
export function removeUpload(filename) {
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(filename)))
  } catch {
    /* already gone — ignore */
  }
}
