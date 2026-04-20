// backend/src/modules/access/validators/permission.validation.js
const { z } = require('zod')

function toPositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

function toBooleanOrUndefined(value) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  if (value === '' || value == null) return undefined
  return undefined
}

const listQuerySchema = z
  .object({
    page: z.any().optional(),
    limit: z.any().optional(),
    q: z.any().optional(),
    module: z.any().optional(),
    isActive: z.any().optional(),
    sortField: z.any().optional(),
    sortOrder: z.any().optional(),
  })
  .transform((value) => {
    const page = toPositiveInt(value.page, 1)
    const limit = Math.min(toPositiveInt(value.limit, 10), 100)

    const allowedSortFields = [
      'module',
      'code',
      'name',
      'createdAt',
      'updatedAt',
    ]

    const rawSortField = String(value.sortField || '').trim()
    const sortField = allowedSortFields.includes(rawSortField)
      ? rawSortField
      : 'module'

    const rawSortOrder = Number(value.sortOrder)
    const sortOrder = rawSortOrder === -1 ? -1 : 1

    return {
      page,
      limit,
      q: String(value.q || '').trim(),
      module: String(value.module || '').trim().toUpperCase(),
      isActive: toBooleanOrUndefined(value.isActive),
      sortField,
      sortOrder,
    }
  })

function normalizeListQuery(data = {}) {
  return listQuerySchema.parse(data)
}

module.exports = {
  listQuerySchema,
  normalizeListQuery,
}