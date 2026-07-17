import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import Policy from './models/Policy.js'

// ─────────────────────────────────────────────────────────────
// Wipe ALL documents: every uploaded file on disk AND every document
// reference stored on policies. Leaves companies/policies otherwise intact.
// Run with:  npm run clear:docs
// ─────────────────────────────────────────────────────────────

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'

async function run() {
  await connectDB(process.env.MONGODB_URI)

  // 1. Clear every document reference in the database.
  const res = await Policy.updateMany(
    { 'documents.0': { $exists: true } },
    { $set: { documents: [] } }
  )
  console.log(`✓ Cleared document references on ${res.modifiedCount} policy/policies`)

  // 2. Delete every file in the uploads folder (keep the .gitkeep placeholder).
  let deleted = 0
  if (fs.existsSync(UPLOAD_DIR)) {
    for (const name of fs.readdirSync(UPLOAD_DIR)) {
      if (name === '.gitkeep') continue
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, name))
        deleted++
      } catch (e) {
        console.warn(`  ! could not delete ${name}: ${e.message}`)
      }
    }
  }
  console.log(`✓ Deleted ${deleted} file(s) from ${UPLOAD_DIR}/`)

  await mongoose.disconnect()
  console.log('✓ Done — no document files and no document references remain')
}

run().catch((err) => {
  console.error('✗ clear-documents failed:', err)
  process.exit(1)
})
