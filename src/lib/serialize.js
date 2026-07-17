// Strip Mongo bookkeeping fields the frontend never uses.
export function stripMongo(obj) {
  if (!obj) return obj
  const { _id, __v, ...rest } = obj
  return rest
}
