import { Router } from 'express'
import Policy from '../models/Policy.js'
import { dashboardStats, activityStats } from '../lib/stats.js'

const router = Router()

// GET /api/stats/dashboard — range-independent KPIs, charts, expiring table
router.get('/dashboard', async (req, res, next) => {
  try {
    const policies = await Policy.find().lean()
    res.json(dashboardStats(policies))
  } catch (e) {
    next(e)
  }
})

// GET /api/stats/activity?from=&to= — activity numbers for a date range
router.get('/activity', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(0)
    const to = req.query.to ? new Date(req.query.to) : new Date()
    const policies = await Policy.find().lean()
    res.json(activityStats(policies, from, to))
  } catch (e) {
    next(e)
  }
})

export default router
