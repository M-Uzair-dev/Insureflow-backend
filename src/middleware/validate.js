// Validate req.body against a Zod schema. On success, replaces req.body with the
// parsed (coerced, defaulted) value. On failure, responds 400 with the issues.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.issues })
    }
    req.body = result.data
    next()
  }
}
