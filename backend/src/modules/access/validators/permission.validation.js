// backend/src/modules/access/validators/permission.validation.js

const { z } = require('zod')

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null) return ''
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

const listPermissionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),
  q: z.string().trim().optional().default(''),

  module: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(toBooleanString),

  sortField: z
    .enum(['module', 'code', 'name', 'isActive', 'createdAt', 'updatedAt'])
    .optional()
    .default('module'),

  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === -1 || value === '-1' || value === 'desc') return -1
      if (value === 1 || value === '1' || value === 'asc') return 1
      return 1
    }),
})

module.exports = {
  listPermissionQuerySchema,
}