import { Router } from 'express'
import Policy from '../models/Policy.js'
import { pageParams, escapeRegex } from '../lib/paginate.js'

const router = Router()

// GET /api/commissions — ONE PAGE of flattened commission entries (one per term),
// paginated at the DB via $unwind + $facet. `summary` carries the whole-dataset
// paid/pending totals (paid = all paid; pending = unpaid excluding Canceled policies).
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, search } = pageParams(req.query)
    const { paid, type } = req.query
    const today = new Date().toISOString().slice(0, 10)

    // Compute policyStatus, flatten terms into one row each.
    const base = [
      { $addFields: { _current: { $arrayElemAt: ['$terms', -1] } } },
      {
        $addFields: {
          policyStatus: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'Canceled'] }, then: 'Canceled' },
                { case: { $lte: ['$_current.endDate', today] }, then: 'Expired' },
              ],
              default: 'Active',
            },
          },
        },
      },
      { $unwind: '$terms' },
      {
        $project: {
          _id: 0,
          key: '$terms.id',
          policyId: '$id',
          owner: 1,
          company: 1,
          section: 1,
          policyStatus: 1,
          startDate: '$terms.startDate',
          endDate: '$terms.endDate',
          premium: '$terms.premium',
          commissionPct: '$terms.commissionPct',
          commission: '$terms.commission',
          paid: '$terms.commissionPaid',
          type: { $cond: [{ $eq: ['$terms.type', 'creation'] }, 'New Policy', 'Renewal'] },
          isRenewal: { $eq: ['$terms.type', 'renewal'] },
          termId: '$terms.id',
        },
      },
    ]

    const fm = {}
    if (search) {
      const rx = escapeRegex(search)
      fm.$or = ['policyId', 'owner', 'company'].map((f) => ({ [f]: { $regex: rx, $options: 'i' } }))
    }
    if (paid && paid !== 'All') fm.paid = paid === 'Paid'
    if (type && type !== 'All') fm.type = type
    const matchArr = Object.keys(fm).length ? [{ $match: fm }] : []

    const [agg] = await Policy.aggregate([
      ...base,
      {
        $facet: {
          items: [...matchArr, { $sort: { policyId: 1, termId: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
          filteredTotal: [...matchArr, { $count: 'n' }],
          summary: [
            {
              $group: {
                _id: null,
                paid: { $sum: { $cond: [{ $eq: ['$paid', true] }, '$commission', 0] } },
                pending: {
                  $sum: {
                    $cond: [{ $and: [{ $eq: ['$paid', false] }, { $ne: ['$policyStatus', 'Canceled'] }] }, '$commission', 0],
                  },
                },
              },
            },
          ],
        },
      },
    ])

    const summary = agg.summary[0]
      ? { paid: agg.summary[0].paid, pending: agg.summary[0].pending }
      : { paid: 0, pending: 0 }
    res.json({ items: agg.items, total: agg.filteredTotal[0]?.n ?? 0, page, limit, summary })
  } catch (e) {
    next(e)
  }
})

export default router
