// Monotonic term id from the highest existing "-T{n}" suffix (not array length),
// so deleting a term never lets a later renewal reissue an existing id.
// Ported from the frontend AppContext `nextTermId`.
export function nextTermId(policy) {
  const maxSeq = policy.terms.reduce((m, t) => {
    const n = Number(t.id.slice(t.id.lastIndexOf('-T') + 2))
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `${policy.id}-T${maxSeq + 1}`
}

// Next "POL-0XX" id from the highest existing numeric suffix (not list length),
// so deleting a policy never lets a new one reissue an existing id.
export function nextPolicyId(policies) {
  const maxSeq = policies.reduce((m, p) => {
    const n = Number(String(p.id).replace(/^POL-/, ''))
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return `POL-${String(maxSeq + 1).padStart(3, '0')}`
}

// Next numeric company id (max existing + 1).
export function nextCompanyId(companies) {
  const max = companies.reduce((m, c) => (c.id > m ? c.id : m), 0)
  return max + 1
}
