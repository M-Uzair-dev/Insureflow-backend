import { effectiveStatus } from './derive.js'

// All dashboard / notifications numbers are computed here over the FULL dataset,
// so the frontend never has to load every row to show correct totals. Logic is
// ported 1:1 from the old client-side computations (overview + notifications pages).

const MS_DAY = 86400000

// ── Dashboard (range-independent): KPIs, health, charts, expiring table ──────
export function dashboardStats(policies) {
  const now = new Date()
  const total = policies.length
  let active = 0
  let expired = 0
  let canceled = 0
  let totalPremium = 0
  let commPending = 0
  const expiringPolicies = []

  for (const p of policies) {
    const st = effectiveStatus(p)
    if (st === 'Active') active++
    else if (st === 'Expired') expired++
    else canceled++

    const current = p.terms[p.terms.length - 1]
    if (current) totalPremium += current.premium
    for (const t of p.terms) if (!t.commissionPaid) commPending += t.commission

    if (st === 'Active' && current) {
      const daysLeft = Math.ceil((new Date(current.endDate).getTime() - now.getTime()) / MS_DAY)
      if (daysLeft >= 0 && daysLeft <= 30) {
        expiringPolicies.push({
          id: p.id, owner: p.owner, company: p.company, section: p.section,
          endDate: current.endDate, daysLeft,
        })
      }
    }
  }
  expiringPolicies.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
  const expiringSoon = expiringPolicies.length
  const inactive = total - active

  // Charts
  const companyNames = [...new Set(policies.map((p) => p.company))]
  const sectionByCompany = companyNames.map((co) => ({
    company: co,
    commercial: policies.filter((p) => p.company === co && p.section === 'Commercial').length,
    residential: policies.filter((p) => p.company === co && p.section === 'Residential').length,
  }))
  const commissionByCompany = companyNames.map((co) => {
    let paid = 0
    let pending = 0
    for (const p of policies) {
      if (p.company !== co) continue
      for (const t of p.terms) t.commissionPaid ? (paid += t.commission) : (pending += t.commission)
    }
    return { company: co, paid, pending }
  })

  // Premium trend — last 6 calendar months, total premium written (all terms whose
  // startDate falls in each month).
  const premiumTrend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
    let value = 0
    for (const p of policies) {
      for (const t of p.terms) {
        const sd = new Date(t.startDate)
        if (sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth()) value += t.premium
      }
    }
    premiumTrend.push({ label, value })
  }

  return {
    kpis: { total, active, expiringSoon, inactive, totalPremium, commPending },
    health: {
      activePct: total ? Math.round((active / total) * 100) : 0,
      expiringPct: total ? Math.round((expiringSoon / total) * 100) : 0,
    },
    charts: { status: { active, expired, canceled }, sectionByCompany, commissionByCompany, premiumTrend },
    expiringPolicies,
  }
}

// ── Activity in a date range: new / renewals / cancellations / premium written ─
export function activityStats(policies, from, to) {
  const inRange = (s) => {
    const d = new Date(s)
    return d >= from && d <= to
  }
  let newPolicies = 0
  let renewals = 0
  let cancellations = 0
  let premiumWritten = 0
  for (const p of policies) {
    const first = p.terms[0]
    if (first && inRange(first.startDate)) {
      newPolicies++
      premiumWritten += first.premium
    }
    if (p.status === 'Canceled' && first && inRange(first.startDate)) cancellations++
    for (const t of p.terms) if (t.type === 'renewal' && inRange(t.startDate)) renewals++
  }
  return { newPolicies, renewals, cancellations, premiumWritten }
}

// ── Notifications: expiring soon (≤30d) + recently expired (≤60d ago) ─────────
export function notificationStats(policies) {
  const now = new Date()
  const expiringSoon = []
  const recentlyExpired = []
  for (const p of policies) {
    const current = p.terms[p.terms.length - 1]
    if (!current) continue
    const st = effectiveStatus(p)
    const end = new Date(current.endDate).getTime()
    const daysLeft = Math.ceil((end - now.getTime()) / MS_DAY)
    if (st === 'Active' && daysLeft >= 0 && daysLeft <= 30) {
      expiringSoon.push({
        id: p.id, owner: p.owner, company: p.company, section: p.section,
        endDate: current.endDate, daysLeft, effectiveStatus: st,
      })
    }
    if (p.status !== 'Canceled') {
      const daysAgo = Math.ceil((now.getTime() - end) / MS_DAY)
      if (daysAgo >= 0 && daysAgo <= 60) {
        recentlyExpired.push({
          id: p.id, owner: p.owner, company: p.company, section: p.section,
          endDate: current.endDate, daysAgo, effectiveStatus: st,
        })
      }
    }
  }
  expiringSoon.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
  recentlyExpired.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
  return {
    expiringSoon,
    recentlyExpired,
    counts: { expiringSoon: expiringSoon.length, recentlyExpired: recentlyExpired.length },
  }
}
