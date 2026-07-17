import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import Company from './models/Company.js'
import Policy from './models/Policy.js'

// ─────────────────────────────────────────────────────────────
// Generative seed — ported from the frontend `lib/mockData.ts`, but every
// coverage-period date is computed off the REAL current date so the app shows a
// realistic mix of Active / Expiring / Expired / Canceled today. Re-runnable
// (drops both collections first).
// ─────────────────────────────────────────────────────────────

const today = new Date()
const fmtDate = (d) => d.toISOString().split('T')[0]
const addDays = (date, days) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const companies = [
  { id: 1, name: 'Shield Insurance Co.', email: 'info@shieldins.com', contact: '+1 (555) 010-1234', created: '2023-01-15' },
  { id: 2, name: 'Apex Underwriters', email: 'contact@apexuw.com', contact: '+1 (555) 020-5678', created: '2023-03-20' },
  { id: 3, name: 'Horizon Mutual', email: 'hello@horizonmutual.com', contact: '+1 (555) 030-9012', created: '2022-11-10' },
  { id: 4, name: 'Summit Assurance', email: 'info@summitassure.com', contact: '+1 (555) 040-3456', created: '2024-01-08' },
  { id: 5, name: 'Pinnacle Risk Group', email: 'admin@pinnaclerisk.com', contact: '+1 (555) 050-7890', created: '2023-07-22' },
]

const owners = [
  'Marcus Thompson', 'Sarah Chen', 'David Rodriguez', 'Emily Watson', 'James Miller',
  'Lisa Park', 'Robert Kim', 'Amanda Foster', 'Michael Chang', 'Jennifer Lee',
  'Daniel Brown', 'Rachel Green', 'Chris Wilson', 'Michelle Davis', 'Kevin Martinez',
  'Laura Anderson', 'Steven Taylor', 'Nicole White', 'Brian Harris', 'Samantha Clark',
]

const streets = ['Oak Street', 'Maple Avenue', 'Pine Boulevard', 'Cedar Drive', 'Elm Lane', 'Business Park Dr', 'Commerce Way', 'Industrial Blvd']
const cities = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ', 'Philadelphia, PA', 'San Antonio, TX', 'Dallas, TX']

const rawPolicies = [
  { companyId: 1, section: 'Commercial', ownerIdx: 0,  valueK: 2500, premPct: 0.0082, commPct: 5, startOffset: -365, endOffset: 0,    status: 'Active',   commPaid: true,  docCount: 2 },
  { companyId: 1, section: 'Residential', ownerIdx: 1, valueK: 850,  premPct: 0.0065, commPct: 4, startOffset: -300, endOffset: 65,   status: 'Active',   commPaid: true,  docCount: 1 },
  { companyId: 1, section: 'Commercial', ownerIdx: 2,  valueK: 4200, premPct: 0.0078, commPct: 6, startOffset: -340, endOffset: 25,   status: 'Active',   commPaid: false, docCount: 2 },
  { companyId: 2, section: 'Residential', ownerIdx: 3, valueK: 620,  premPct: 0.0070, commPct: 4, startOffset: -410, endOffset: -45,  status: 'Expired',  commPaid: true,  docCount: 1 },
  { companyId: 2, section: 'Commercial', ownerIdx: 4,  valueK: 3100, premPct: 0.0085, commPct: 5, startOffset: -280, endOffset: 85,   status: 'Active',   commPaid: true,  docCount: 3 },
  { companyId: 2, section: 'Residential', ownerIdx: 5, valueK: 780,  premPct: 0.0068, commPct: 4, startOffset: -200, endOffset: 165,  status: 'Active',   commPaid: false, docCount: 1 },
  { companyId: 3, section: 'Commercial', ownerIdx: 6,  valueK: 5500, premPct: 0.0075, commPct: 7, startOffset: -360, endOffset: 20,   status: 'Active',   commPaid: true,  docCount: 2 },
  { companyId: 3, section: 'Residential', ownerIdx: 7, valueK: 950,  premPct: 0.0060, commPct: 5, startOffset: -180, endOffset: 185,  status: 'Active',   commPaid: true,  docCount: 1 },
  { companyId: 3, section: 'Commercial', ownerIdx: 8,  valueK: 2800, premPct: 0.0082, commPct: 5, startOffset: -420, endOffset: -55,  status: 'Expired',  commPaid: false, docCount: 2 },
  { companyId: 4, section: 'Residential', ownerIdx: 9, valueK: 1100, premPct: 0.0062, commPct: 4, startOffset: -150, endOffset: 215,  status: 'Active',   commPaid: true,  docCount: 1 },
  { companyId: 4, section: 'Commercial', ownerIdx: 10, valueK: 3800, premPct: 0.0079, commPct: 6, startOffset: -365, endOffset: 18,   status: 'Active',   commPaid: false, docCount: 3 },
  { companyId: 5, section: 'Residential', ownerIdx: 11, valueK: 720, premPct: 0.0066, commPct: 4, startOffset: -260, endOffset: -15,  status: 'Expired',  commPaid: true,  docCount: 1 },
  { companyId: 5, section: 'Commercial', ownerIdx: 12, valueK: 6200, premPct: 0.0071, commPct: 7, startOffset: -120, endOffset: 245,  status: 'Active',   commPaid: true,  docCount: 2 },
  { companyId: 1, section: 'Residential', ownerIdx: 13, valueK: 890, premPct: 0.0063, commPct: 4, startOffset: -90,  endOffset: 275,  status: 'Active',   commPaid: true,  docCount: 1 },
  { companyId: 2, section: 'Commercial', ownerIdx: 14, valueK: 1950, premPct: 0.0087, commPct: 5, startOffset: -200, endOffset: -40,  status: 'Canceled', commPaid: false, docCount: 1 },
  { companyId: 3, section: 'Residential', ownerIdx: 15, valueK: 1350, premPct: 0.0064, commPct: 5, startOffset: -75, endOffset: 290,  status: 'Active',   commPaid: false, docCount: 2 },
  { companyId: 4, section: 'Commercial', ownerIdx: 16, valueK: 4700, premPct: 0.0077, commPct: 6, startOffset: -310, endOffset: -55,  status: 'Canceled', commPaid: true,  docCount: 2 },
  { companyId: 5, section: 'Residential', ownerIdx: 17, valueK: 560, premPct: 0.0069, commPct: 4, startOffset: -45,  endOffset: 320,  status: 'Active',   commPaid: true,  docCount: 1 },
  { companyId: 1, section: 'Commercial', ownerIdx: 18, valueK: 3300, premPct: 0.0080, commPct: 5, startOffset: -60,  endOffset: 305,  status: 'Active',   commPaid: false, docCount: 2 },
  { companyId: 2, section: 'Residential', ownerIdx: 19, valueK: 480, premPct: 0.0072, commPct: 4, startOffset: -30,  endOffset: 335,  status: 'Active',   commPaid: true,  docCount: 1 },
]

// Old flat model stored 'Expired'; now only 'Active' | 'Canceled' are stored and
// expiry is derived from the current term's endDate.
const storedStatus = (s) => (s === 'Canceled' ? 'Canceled' : 'Active')

const policies = rawPolicies.map((p, i) => {
  const company = companies.find((c) => c.id === p.companyId)
  const totalValue = p.valueK * 1000
  const premium = Math.round(totalValue * p.premPct)
  const commission = Math.round((premium * p.commPct) / 100)
  const startDate = fmtDate(addDays(today, p.startOffset))
  const endDate = fmtDate(addDays(today, p.endOffset))
  const owner = owners[p.ownerIdx]
  const emailName = owner.toLowerCase().replace(' ', '.')
  const policyId = `POL-${String(i + 1).padStart(3, '0')}`
  return {
    id: policyId,
    companyId: p.companyId,
    company: company.name,
    section: p.section,
    owner,
    address: `${100 + i * 43} ${streets[i % streets.length]}, ${cities[i % cities.length]}`,
    totalValue,
    status: storedStatus(p.status),
    contact: `+1 (555) ${String(100 + i * 13).padStart(3, '0')}-${String(2000 + i * 117).padStart(4, '0')}`,
    email: `${emailName}@email.com`,
    documents: Array.from({ length: p.docCount }, (_, j) =>
      j === 0 ? 'Policy_Document.pdf' : j === 1 ? 'Property_Assessment.pdf' : 'ID_Verification.pdf'
    ),
    terms: [
      {
        id: `${policyId}-T1`,
        type: 'creation',
        startDate,
        endDate,
        premium,
        commissionPct: p.commPct,
        commission,
        commissionPaid: p.commPaid,
        createdAt: startDate,
      },
    ],
  }
})

// Prepend an older 'creation' term and demote the base-generated term to a
// 'renewal', giving these policies a multi-term history.
const seedTermHistory = (idx, older) => {
  const pol = policies[idx]
  const base = pol.terms[0]
  const creation = { id: `${pol.id}-T1`, type: 'creation', ...older, createdAt: older.startDate }
  const renewal = { ...base, id: `${pol.id}-T2`, type: 'renewal', createdAt: base.startDate }
  pol.terms = [creation, renewal]
}

seedTermHistory(0, { startDate: fmtDate(addDays(today, -730)), endDate: fmtDate(addDays(today, -366)), premium: 19800, commissionPct: 5, commission: 990, commissionPaid: true })
seedTermHistory(3, { startDate: fmtDate(addDays(today, -775)), endDate: fmtDate(addDays(today, -411)), premium: 4100, commissionPct: 4, commission: 164, commissionPaid: true })
seedTermHistory(8, { startDate: fmtDate(addDays(today, -785)), endDate: fmtDate(addDays(today, -421)), premium: 22400, commissionPct: 5, commission: 1120, commissionPaid: true })
seedTermHistory(6, { startDate: fmtDate(addDays(today, -725)), endDate: fmtDate(addDays(today, -361)), premium: 40200, commissionPct: 7, commission: 2814, commissionPaid: true })

async function run() {
  await connectDB(process.env.MONGODB_URI)
  await Promise.all([Company.deleteMany({}), Policy.deleteMany({})])
  await Company.insertMany(companies)
  await Policy.insertMany(policies)
  const multiTerm = policies.filter((p) => p.terms.length > 1).length
  console.log(`✓ Seeded ${companies.length} companies and ${policies.length} policies (${multiTerm} with multi-term history)`)
  await mongoose.disconnect()
  console.log('✓ Done')
}

run().catch((err) => {
  console.error('✗ Seed failed:', err)
  process.exit(1)
})
