import { Router } from 'express'
import Company from '../models/Company.js'
import Policy from '../models/Policy.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { validate } from '../middleware/validate.js'
import { companyInput } from '../lib/zodSchemas.js'
import { nextCompanyId } from '../lib/ids.js'
import { stripMongo } from '../lib/serialize.js'
import { removeUpload } from '../middleware/upload.js'
import { pageParams, escapeRegex } from '../lib/paginate.js'

const router = Router()

// GET /api/companies — ONE PAGE of companies + total. Search over whole set.
// Each item carries a policyCount. Returns { items, total, page, limit }.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, search } = pageParams(req.query)
    const q = {}
    if (search) {
      const rx = escapeRegex(search)
      q.$or = ['name', 'email', 'contact'].map((f) => ({ [f]: { $regex: rx, $options: 'i' } }))
    }
    const [items, total, counts] = await Promise.all([
      Company.find(q).sort({ id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Company.countDocuments(q),
      Policy.aggregate([{ $group: { _id: '$companyId', n: { $sum: 1 } } }]),
    ])
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.n]))
    res.json({
      items: items.map((c) => ({ ...stripMongo(c), policyCount: countMap[c.id] || 0 })),
      total,
      page,
      limit,
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/companies/options — id + name of every company (for dropdowns).
router.get('/options', async (req, res, next) => {
  try {
    const companies = await Company.find().sort({ id: 1 }).select('id name').lean()
    res.json(companies.map((c) => ({ id: c.id, name: c.name })))
  } catch (e) {
    next(e)
  }
})

// POST /api/companies — create (admin)
router.post('/', requireAdmin, validate(companyInput), async (req, res, next) => {
  try {
    const all = await Company.find().select('id').lean()
    const id = nextCompanyId(all)
    const created = new Date().toISOString().split('T')[0]
    const company = await Company.create({ ...req.body, id, created })
    res.status(201).json(stripMongo(company.toObject()))
  } catch (e) {
    next(e)
  }
})

// PUT /api/companies/:id — edit (admin); syncs denormalized policy.company
router.put('/:id', requireAdmin, validate(companyInput), async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const company = await Company.findOneAndUpdate({ id }, { $set: req.body }, { new: true }).lean()
    if (!company) return res.status(404).json({ error: 'Company not found' })
    await Policy.updateMany({ companyId: id }, { $set: { company: req.body.name } })
    res.json(stripMongo(company))
  } catch (e) {
    next(e)
  }
})

// DELETE /api/companies/:id — delete (admin); cascades to that company's policies
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const company = await Company.findOneAndDelete({ id })
    if (!company) return res.status(404).json({ error: 'Company not found' })
    // Delete document files of every cascade-removed policy so none are orphaned.
    const doomed = await Policy.find({ companyId: id }).select('documents').lean()
    doomed.forEach((p) => (p.documents || []).forEach(removeUpload))
    await Policy.deleteMany({ companyId: id })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

export default router
