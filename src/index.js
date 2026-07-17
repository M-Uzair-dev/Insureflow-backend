import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

import { connectDB } from './db.js'
import companiesRouter from './routes/companies.js'
import policiesRouter from './routes/policies.js'
import commissionsRouter from './routes/commissions.js'
import statsRouter from './routes/stats.js'
import notificationsRouter from './routes/notifications.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import { UPLOAD_DIR } from './middleware/upload.js'

const PORT = process.env.PORT || 4000
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

const app = express()

// 1. CORS — allow the Next.js frontend (and its x-user-role header)
app.use(cors({ origin: CORS_ORIGIN, allowedHeaders: ['Content-Type', 'x-user-role'] }))

// 2. JSON body parsing
app.use(express.json())

// 3. Basic global rate limit for the whole API (no per-route / fancy limits)
app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false })
)

// 4. Routes
app.get('/api/health', (req, res) => res.json({ ok: true }))
app.use('/api/companies', companiesRouter)
app.use('/api/policies', policiesRouter)
app.use('/api/commissions', commissionsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/notifications', notificationsRouter)

// 5. Static serving of uploaded documents
app.use('/uploads', express.static(UPLOAD_DIR))

// 6. 404 for unknown /api routes, then the central error handler (last)
app.use('/api', notFound)
app.use(errorHandler)

// Connect to Mongo before accepting requests.
await connectDB(process.env.MONGODB_URI)
app.listen(PORT, () => console.log(`✓ InsureFlow API running on http://localhost:${PORT}`))
