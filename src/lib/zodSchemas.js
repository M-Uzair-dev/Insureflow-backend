import { z } from 'zod'

// Zod strips unknown keys by default, so extra fields the modals send
// (e.g. `id`, `commission`) are ignored where not declared.

export const companyInput = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email'),
  contact: z.string().trim().min(1, 'Contact is required'),
})

// The Add/Edit Policy modal only requires owner/address/totalValue/premium/dates,
// so email and contact are optional here (matches the frontend's own validation).
export const policyCreateInput = z.object({
  companyId: z.coerce.number(),
  section: z.enum(['Commercial', 'Residential']),
  owner: z.string().trim().min(1, 'Owner is required'),
  address: z.string().trim().min(1, 'Address is required'),
  totalValue: z.coerce.number().nonnegative(),
  contact: z.string().optional().default(''),
  email: z.string().optional().default(''),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  premium: z.coerce.number().nonnegative(),
  commissionPct: z.coerce.number().nonnegative(),
  commission: z.coerce.number().optional(), // advisory — server recomputes
  documents: z.array(z.string()).optional(),
})

// Same shape as create; documents are managed via the upload endpoint on edit.
export const policyUpdateInput = policyCreateInput

export const renewalInput = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  premium: z.coerce.number().nonnegative(),
  commissionPct: z.coerce.number().nonnegative(),
  commission: z.coerce.number().optional(), // advisory — server recomputes
})

export const statusInput = z.object({
  status: z.enum(['Active', 'Canceled']),
})
