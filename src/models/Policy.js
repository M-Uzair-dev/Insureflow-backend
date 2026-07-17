import mongoose from 'mongoose'

// A coverage period. Embedded on Policy (not a separate collection) — terms are
// always read/written with their policy. `_id: false` because we use the string
// `id` ("POL-001-T1"), not Mongo's ObjectId.
const termSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['creation', 'renewal'], required: true },
    startDate: { type: String, required: true }, // ISO 'YYYY-MM-DD'
    endDate: { type: String, required: true },
    premium: { type: Number, required: true },
    commissionPct: { type: Number, required: true },
    commission: { type: Number, required: true }, // round(premium * pct / 100)
    commissionPaid: { type: Boolean, default: false },
    createdAt: { type: String, required: true },
  },
  { _id: false }
)

const policySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true }, // "POL-001"
    companyId: { type: Number, required: true, index: true },
    company: { type: String, required: true }, // denormalized name — synced on company edit
    section: { type: String, enum: ['Commercial', 'Residential'], required: true, index: true },
    owner: { type: String, default: '' },
    address: { type: String, default: '' },
    totalValue: { type: Number, default: 0 },
    // 'Expired' is NEVER stored — it is derived from the current term's endDate.
    status: { type: String, enum: ['Active', 'Canceled'], default: 'Active' },
    contact: { type: String, default: '' },
    email: { type: String, default: '' },
    documents: { type: [String], default: [] }, // uploaded filenames — policy-level
    terms: { type: [termSchema], default: [] }, // oldest first; last is current
  },
  { versionKey: false }
)

export default mongoose.model('Policy', policySchema)
