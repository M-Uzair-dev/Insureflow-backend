import mongoose from 'mongoose'

// Mirrors the frontend Company entity. Keeps the numeric `id` the frontend
// relies on (Mongo's ObjectId is stripped from responses in serialize.js).
const companySchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    contact: { type: String, required: true },
    created: { type: String, required: true }, // ISO 'YYYY-MM-DD'
  },
  { versionKey: false }
)

export default mongoose.model('Company', companySchema)
