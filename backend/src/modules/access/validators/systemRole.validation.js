// backend/src/modules/access/validators/systemRole.validation.js
const { z } = require('zod')

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null) return ''
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(''),
  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(toBooleanString),
  sortField: z
    .enum(['code', 'displayName', 'isActive', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === -1 || value === '-1' || value === 'desc') return -1
      if (value === 1 || value === '1' || value === 'asc') return 1
      return -1
    }),
})

const createSystemRoleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Role code is required')
    .max(50, 'Role code is too long'),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(100, 'Display name is too long'),
  permissionIds: z.array(objectIdSchema).default([]),
  isActive: z.boolean().optional().default(true),
})

const updateSystemRoleSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Role code is required')
      .max(50, 'Role code is too long')
      .optional(),
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name is required')
      .max(100, 'Display name is too long')
      .optional(),
    permissionIds: z.array(objectIdSchema).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.displayName !== undefined ||
      value.permissionIds !== undefined ||
      value.isActive !== undefined,
    {
      message: 'At least one field is required to update role',
    },
  )

function normalizeListQuery(raw = {}) {
  return listQuerySchema.parse(raw)
}

module.exports = {
  createSystemRoleSchema,
  updateSystemRoleSchema,
  normalizeListQuery,
}