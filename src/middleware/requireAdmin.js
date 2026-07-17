// Mock-role guard (NOT real auth). Mirrors the frontend hiding admin-only
// buttons: the client sends its chosen role in the `x-user-role` header, and
// write endpoints refuse anything other than 'admin'.
export function requireAdmin(req, res, next) {
  if (req.header('x-user-role') === 'admin') return next()
  return res.status(403).json({ error: 'Admin role required' })
}
