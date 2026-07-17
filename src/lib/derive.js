import { stripMongo } from './serialize.js'

// Ported from the frontend `lib/mockData.ts`, but uses the REAL current date
// (`new Date()`) instead of the old hardcoded 2026-04-28. `Expired` is never
// stored — always derived from the current term's endDate.
export function effectiveStatus(policy) {
  if (policy.status === 'Canceled') return 'Canceled'
  const current = policy.terms[policy.terms.length - 1]
  if (!current) return 'Active'
  return new Date(current.endDate) < new Date() ? 'Expired' : 'Active'
}

// Serialize a policy for the client: plain object + computed `effectiveStatus`,
// with Mongo internals removed. Accepts a Mongoose doc or a lean/plain object.
export function toClient(policy) {
  const obj = typeof policy.toObject === 'function' ? policy.toObject() : policy
  return { ...stripMongo(obj), effectiveStatus: effectiveStatus(obj) }
}

// One entry per PolicyTerm across all policies. Mirrors the frontend
// `flattenCommissions`, but emits a stable `termId` instead of `termIdx`
// (array indices are unsafe across a network boundary).
export function flattenCommissions(policies) {
  return policies.flatMap((p) =>
    p.terms.map((t) => ({
      key: t.id,
      policyId: p.id,
      owner: p.owner,
      company: p.company,
      section: p.section,
      policyStatus: effectiveStatus(p),
      startDate: t.startDate,
      endDate: t.endDate,
      premium: t.premium,
      commissionPct: t.commissionPct,
      commission: t.commission,
      paid: t.commissionPaid,
      type: t.type === 'creation' ? 'New Policy' : 'Renewal',
      isRenewal: t.type === 'renewal',
      termId: t.id,
    }))
  )
}
