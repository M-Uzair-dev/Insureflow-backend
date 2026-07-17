// Parse common pagination/search query params with safe bounds.
export function pageParams(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10))
  const search = (query.search || '').trim().toLowerCase()
  return { page, limit, search }
}

// Escape user input so it is matched literally inside a MongoDB $regex.
export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
