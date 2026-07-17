import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import Company from './models/Company.js'
import Policy from './models/Policy.js'

// ─────────────────────────────────────────────────────────────
// FULL WIPE: drop every company and policy AND delete every uploaded file.
// Leaves an empty database and an empty uploads/ folder. Run with:  npm run clear
// (Repopulate anytime with:  npm run seed)
// ─────────────────────────────────────────────────────────────

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'

async function run() {
  await connectDB(process.env.MONGODB_URI)

  // 1. Drop all documents-collections.
  const [pol, co] = await Promise.all([Policy.deleteMany({}), Company.deleteMany({})])
  console.log(`✓ Deleted ${co.deletedCount} company/companies and ${pol.deletedCount} policy/policies`)

  // 2. Delete every uploaded file (keep the .gitkeep placeholder).
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
  console.log('✓ Done — database is empty and no document files remain')
}

run().catch((err) => {
  console.error('✗ clear failed:', err)
  process.exit(1)
})
