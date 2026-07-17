import { Router } from 'express'
import Policy from '../models/Policy.js'
import { notificationStats } from '../lib/stats.js'

const router = Router()

// GET /api/notifications — expiring-soon + recently-expired lists (whole dataset)
router.get('/', async (req, res, next) => {
  try {
    const policies = await Policy.find().lean()
    res.json(notificationStats(policies))
  } catch (e) {
    next(e)
  }
})

export default router
