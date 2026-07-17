import { Router } from 'express'
import Policy from '../models/Policy.js'
import Company from '../models/Company.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { validate } from '../middleware/validate.js'
import { upload, removeUpload } from '../middleware/upload.js'
import { policyCreateInput, policyUpdateInput, renewalInput, statusInput } from '../lib/zodSchemas.js'
import { toClient } from '../lib/derive.js'
import { nextTermId, nextPolicyId } from '../lib/ids.js'
import { pageParams, escapeRegex } from '../lib/paginate.js'

const router = Router()

const round = (n) => Math.round(n)
const todayISO = () => new Date().toISOString().split('T')[0]

// GET /api/policies — ONE PAGE of policies + total. Supports search + filters.
// Search & filters run over the whole collection (server-side), so they are
// universal, not per-page. Returns { items, total, page, limit }.
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, search } = pageParams(req.query)
    const { status, section, companyId } = req.query
    const today = new Date().toISOString().slice(0, 10)

    // Plain/indexed filters run BEFORE computing effectiveStatus so an index can
    // narrow the set; the derived-status filter runs after (endDate is stored as
    // 'YYYY-MM-DD', so a string <= today == chronologically past/now == Expired).
    const preMatch = {}
    if (search) {
      const rx = escapeRegex(search)
      preMatch.$or = ['id', 'owner', 'company', 'address'].map((f) => ({ [f]: { $regex: rx, $options: 'i' } }))
    }
    if (section) preMatch.section = section
    if (companyId) preMatch.companyId = Number(companyId)

    const pipeline = []
    if (Object.keys(preMatch).length) pipeline.push({ $match: preMatch })
    pipeline.push(
      { $addFields: { _current: { $arrayElemAt: ['$terms', -1] } } },
      {
        $addFields: {
          effectiveStatus: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'Canceled'] }, then: 'Canceled' },
                { case: { $lte: ['$_current.endDate', today] }, then: 'Expired' },
              ],
              default: 'Active',
            },
          },
        },
      }
    )
    if (status) pipeline.push({ $match: { effectiveStatus: status } })
    pipeline.push(
      { $project: { _id: 0, _current: 0 } },
      { $sort: { id: 1 } },
      { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } }
    )

    const [result] = await Policy.aggregate(pipeline)
    res.json({ items: result.items, total: result.total[0]?.n ?? 0, page, limit })
  } catch (e) {
    next(e)
  }
})

// GET /api/policies/:id — one full policy (used when opening a modal from a
// summary row on the dashboard / notifications).
router.get('/:id', async (req, res, next) => {
  try {
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    res.json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// POST /api/policies — create (admin); server builds the "creation" term (-T1)
router.post('/', requireAdmin, validate(policyCreateInput), async (req, res, next) => {
  try {
    const b = req.body
    const company = await Company.findOne({ id: b.companyId }).lean()
    if (!company) return res.status(400).json({ error: 'Unknown companyId' })

    const all = await Policy.find().select('id').lean()
    const id = nextPolicyId(all)
    const commission = round(b.premium * b.commissionPct / 100)

    const policy = await Policy.create({
      id,
      companyId: b.companyId,
      company: company.name,
      section: b.section,
      owner: b.owner,
      address: b.address,
      totalValue: b.totalValue,
      status: 'Active',
      contact: b.contact,
      email: b.email,
      documents: b.documents ?? [],
      terms: [
        {
          id: `${id}-T1`,
          type: 'creation',
          startDate: b.startDate,
          endDate: b.endDate,
          premium: b.premium,
          commissionPct: b.commissionPct,
          commission,
          commissionPaid: false,
          createdAt: todayISO(),
        },
      ],
    })
    res.status(201).json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// PUT /api/policies/:id — edit (admin); updates policy fields AND the current term
router.put('/:id', requireAdmin, validate(policyUpdateInput), async (req, res, next) => {
  try {
    const b = req.body
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })

    const company = await Company.findOne({ id: b.companyId }).lean()
    const commission = round(b.premium * b.commissionPct / 100)

    const current = policy.terms[policy.terms.length - 1]
    if (current) {
      current.startDate = b.startDate
      current.endDate = b.endDate
      current.premium = b.premium
      current.commissionPct = b.commissionPct
      current.commission = commission
    }

    policy.companyId = b.companyId
    policy.company = company?.name ?? policy.company
    policy.section = b.section
    policy.owner = b.owner
    policy.address = b.address
    policy.totalValue = b.totalValue
    policy.contact = b.contact
    policy.email = b.email
    // If the document list is provided, delete any files this edit dereferenced
    // so nothing is left orphaned on disk.
    const removedDocs = b.documents
      ? policy.documents.filter((d) => !b.documents.includes(d))
      : []
    if (b.documents) policy.documents = b.documents

    await policy.save()
    removedDocs.forEach(removeUpload)
    res.json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// DELETE /api/policies/:id — delete (admin)
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const policy = await Policy.findOneAndDelete({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    // Delete the policy's document files so they are not orphaned.
    policy.documents.forEach(removeUpload)
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// PATCH /api/policies/:id/status — set Active/Canceled (admin)
router.patch('/:id/status', requireAdmin, validate(statusInput), async (req, res, next) => {
  try {
    const policy = await Policy.findOneAndUpdate(
      { id: req.params.id },
      { $set: { status: req.body.status } },
      { new: true }
    )
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    res.json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// POST /api/policies/:id/terms — renew (admin); appends a "renewal" term
router.post('/:id/terms', requireAdmin, validate(renewalInput), async (req, res, next) => {
  try {
    const b = req.body
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })

    const commission = round(b.premium * b.commissionPct / 100)
    policy.terms.push({
      id: nextTermId(policy),
      type: 'renewal',
      startDate: b.startDate,
      endDate: b.endDate,
      premium: b.premium,
      commissionPct: b.commissionPct,
      commission,
      commissionPaid: false,
      createdAt: todayISO(),
    })
    policy.status = 'Active' // renewing reactivates
    await policy.save()
    res.status(201).json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// DELETE /api/policies/:id/terms/:termId — delete a term (admin); never the last one
router.delete('/:id/terms/:termId', requireAdmin, async (req, res, next) => {
  try {
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    if (policy.terms.length <= 1) {
      return res.status(409).json({ error: 'Cannot delete the last remaining term' })
    }
    const idx = policy.terms.findIndex((t) => t.id === req.params.termId)
    if (idx === -1) return res.status(404).json({ error: 'Term not found' })
    policy.terms.splice(idx, 1)
    await policy.save()
    res.json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// PATCH /api/policies/:id/terms/:termId/paid — flip commissionPaid (admin)
router.patch('/:id/terms/:termId/paid', requireAdmin, async (req, res, next) => {
  try {
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    const term = policy.terms.find((t) => t.id === req.params.termId)
    if (!term) return res.status(404).json({ error: 'Term not found' })
    term.commissionPaid = !term.commissionPaid
    await policy.save()
    res.json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// POST /api/policies/:id/documents — upload files (admin); appends filenames
router.post('/:id/documents', requireAdmin, upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files ?? []
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) {
      // Clean up any files that were saved before we found the policy missing.
      files.forEach((f) => removeUpload(f.filename))
      return res.status(404).json({ error: 'Policy not found' })
    }
    const names = files.map((f) => f.filename)
    policy.documents.push(...names)
    await policy.save()
    res.status(201).json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

// DELETE /api/policies/:id/documents/:filename — remove a document (admin)
router.delete('/:id/documents/:filename', requireAdmin, async (req, res, next) => {
  try {
    const policy = await Policy.findOne({ id: req.params.id })
    if (!policy) return res.status(404).json({ error: 'Policy not found' })
    const { filename } = req.params
    policy.documents = policy.documents.filter((d) => d !== filename)
    await policy.save()
    removeUpload(filename)
    res.json(toClient(policy))
  } catch (e) {
    next(e)
  }
})

export default router
