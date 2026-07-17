import mongoose from 'mongoose'

// Connect once on boot. Crash loudly if it fails — there is no point
// serving requests without a database.
export async function connectDB(uri) {
  if (!uri) {
    console.error('✗ MONGODB_URI is not set. Add it to backend/.env')
    process.exit(1)
  }
  try {
    // Force the `insureflow` database regardless of whether the URI path
    // includes it, so data never lands in the default `test` db.
    await mongoose.connect(uri, { dbName: process.env.DB_NAME || 'insureflow' })
    console.log('✓ Connected to MongoDB')
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err.message)
    process.exit(1)
  }
}
