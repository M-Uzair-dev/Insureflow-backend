# InsureFlow Backend

REST API for the InsureFlow portal. **Express + Mongoose + MongoDB Atlas**, Zod
validation, Multer local file uploads, basic rate limiting. No caching, no real
auth (mock roles via an `x-user-role` header), no pagination — matches the
frontend's plain, dependency-light style.

## Setup

```bash
cd backend
npm install
cp .env.example .env          # then paste your Atlas connection string into MONGODB_URI
npm run seed                  # generative seed relative to today (drops & repopulates)
npm run dev                   # http://localhost:4000  (auto-restart on change)
# or: npm start               # no watch
npm run clear                 # FULL WIPE: drop all companies + policies + delete all files
npm run clear:docs            # narrower: clear only documents (files + references), keep data
```

> After `npm run clear` the database is empty — run `npm run seed` to repopulate.

Requires Node 20+.

### Environment (`.env`)

| Var | Purpose | Default |
|-----|---------|---------|
| `MONGODB_URI` | Atlas SRV connection string (must include your user/pass) | — (required) |
| `DB_NAME` | Database name (forced on connect) | `insureflow` |
| `PORT` | API port | `4000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3000` |
| `UPLOAD_DIR` | Local folder for uploaded documents | `uploads` |
| `MAX_UPLOAD_MB` | Max size per uploaded file (MB) | `10` |

> The DB name is forced to `insureflow` (or `DB_NAME`) on connect, so it doesn't
> matter whether your URI path includes it.

## Auth model (mock)

There is no real authentication. The frontend sends the role it picked on the
login screen in an `x-user-role` header. All **write** endpoints require
`x-user-role: admin` (else `403`). Reads are open. This mirrors the frontend
hiding admin-only buttons — it is a guard, not security.

## Data model

- **Company** — `{ id:Number, name, email, contact, created }`.
- **Policy** — `{ id:"POL-001", companyId, company, section, owner, address,
  totalValue, status:'Active'|'Canceled', contact, email, documents:[String],
  terms:[PolicyTerm] }`. `Expired` is **derived**, never stored.
- **PolicyTerm** (embedded, oldest first; `terms.at(-1)` is current) —
  `{ id:"POL-001-T1", type:'creation'|'renewal', startDate, endDate, premium,
  commissionPct, commission, commissionPaid, createdAt }`.

Every policy response includes a computed `effectiveStatus`
(`'Active' | 'Expired' | 'Canceled'`) based on the **real** current date.

## API

Base path `/api`. JSON in/out. Writes require `x-user-role: admin`.

**Lists are paginated.** `GET /api/companies`, `/api/policies`, `/api/commissions`
take `?page=&limit=&search=` (+ resource filters) and return
`{ items, total, page, limit }`. Search & filters run over the **whole** collection
server-side, so they are universal, never per-page. **Dashboard & notification
numbers are computed server-side over the whole dataset** — the frontend never
loads every row to show correct totals.

| Method & path | Purpose |
|---------------|---------|
| `GET /api/health` | `{ ok: true }` |
| `GET /api/stats/dashboard` | KPIs + chart datasets + expiring list (whole dataset) |
| `GET /api/stats/activity?from=&to=` | new / renewals / cancellations / premium-written for a range |
| `GET /api/notifications` | expiring-soon + recently-expired lists |
| `GET /api/companies?page=&limit=&search=` | one page of companies (+ `policyCount`) |
| `GET /api/companies/options` | `[{id,name}]` of all companies (for dropdowns) |
| `POST /api/companies` | create company |
| `PUT /api/companies/:id` | edit company (syncs denormalized `policy.company`) |
| `DELETE /api/companies/:id` | delete company (**cascades** its policies + their files) |
| `GET /api/policies?page=&limit=&search=&status=&section=&companyId=` | one page of policies (+ `effectiveStatus`) |
| `GET /api/policies/:id` | one full policy (for modals opened from summary rows) |
| `POST /api/policies` | create policy (server builds the `creation` term `-T1`) |
| `PUT /api/policies/:id` | edit policy + its current term |
| `DELETE /api/policies/:id` | delete policy (+ its files) |
| `PATCH /api/policies/:id/status` | `{ status: 'Active' \| 'Canceled' }` |
| `POST /api/policies/:id/terms` | renew — append a `renewal` term |
| `DELETE /api/policies/:id/terms/:termId` | delete a term (**409** if only one remains) |
| `PATCH /api/policies/:id/terms/:termId/paid` | toggle `commissionPaid` |
| `GET /api/commissions?page=&limit=&search=&paid=&type=` | one page of flattened entries + whole-dataset `summary` totals |
| `POST /api/policies/:id/documents` | multipart upload (field `files`), appends filenames |
| `DELETE /api/policies/:id/documents/:filename` | remove a document |
| `GET /uploads/:filename` | serve an uploaded document |

> **List endpoints** (`/policies`, `/commissions`, `/companies`) paginate at the
> database: `$skip`/`$limit` via aggregation. Policies/commissions compute the
> derived `effectiveStatus` in-pipeline (`$arrayElemAt: [terms, -1]` + `$switch`,
> comparing the ISO `endDate` string to today) so status filtering & sorting run
> in Mongo, not JS. Indexes on `Policy.id` / `companyId` / `section` back the
> pre-match. So only the requested page is read + returned.
>
> **Stats/notifications** still load the collection and compute in JS — aggregates
> inherently scan the whole set, and at this app's scale (≤ ~thousands of policies)
> that's negligible. Move them to `$group` aggregation only if the dataset grows
> into tens of thousands.

Term operations use the **stable `termId`** (e.g. `POL-001-T2`), not an array
index. Errors: `{ error, details? }` with `400` (validation) / `403` (role) /
`404` (not found) / `409` (last-term guard) / `500`.

## Document files — no orphans

Uploaded files live in `uploads/` and are referenced by filename in
`policy.documents[]`. Every path that drops a reference also deletes the file:

- **Edit policy** (`PUT /api/policies/:id`) — any filename removed from the
  `documents` list has its file deleted from disk.
- **Delete policy** (`DELETE /api/policies/:id`) — all of the policy's files are deleted.
- **Delete company** (`DELETE /api/companies/:id`) — files of every cascade-removed
  policy are deleted.
- **Delete document** (`DELETE /api/policies/:id/documents/:filename`) — the file is deleted.
- **Upload to a missing policy** — files saved by Multer are removed before the 404.

Deletes are best-effort (`fs.unlink` errors are ignored, so an already-missing file
is fine). To reset from scratch, `npm run clear:docs` empties every `documents[]`
array and deletes every file in `uploads/` (keeps `.gitkeep`).

## Quick smoke test

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/policies
# a write without the admin header should 403:
curl -X POST http://localhost:4000/api/companies \
  -H 'Content-Type: application/json' -d '{"name":"X","email":"x@y.com","contact":"1"}'
# with it, should 201:
curl -X POST http://localhost:4000/api/companies \
  -H 'Content-Type: application/json' -H 'x-user-role: admin' \
  -d '{"name":"X","email":"x@y.com","contact":"1"}'
```

## Wiring the frontend

See `../insureflow/_project-context/backend-implementation-guide.md` §10 for the
step-by-step frontend rewiring (add `NEXT_PUBLIC_API_URL`, a `src/lib/api.ts`
client, make `AppContext` handlers async, drop the local `effectiveStatus` /
`flattenCommissions` helpers and the hardcoded `TODAY`, and switch term ops from
index to `termId`).
"# Insureflow-backend" 
