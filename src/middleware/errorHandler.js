import { ZodError } from 'zod'
import multer from 'multer'

// 404 for unmatched routes.
export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' })
}

// Central error handler — must be registered last.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues })
  }
  if (err instanceof multer.MulterError) {
    // e.g. file too large, unexpected field
    return res.status(400).json({ error: err.message })
  }
  if (err?.message === 'Only PDF, PNG, and JPEG files are allowed') {
    return res.status(400).json({ error: err.message })
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id' })
  }
  console.error(err)
  res.status(500).json({ error: err?.message || 'Internal server error' })
}
