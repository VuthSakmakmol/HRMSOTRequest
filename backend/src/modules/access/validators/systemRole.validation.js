// backend/src/modules/access/validators/systemRole.validation.js

const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'common.validation.invalidId')

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null) return ''
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

const listSystemRoleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(toBooleanString),

  sortField: z
    .enum(['code', 'displayName', 'isActive', 'createdAt', 'updatedAt'])
    .optional()
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
    .min(1, 'access.role.validation.codeRequired')
    .max(50, 'access.role.validation.codeTooLong'),

  displayName: z
    .string()
    .trim()
    .min(1, 'access.role.validation.displayNameRequired')
    .max(100, 'access.role.validation.displayNameTooLong'),

  permissionIds: z.array(objectIdSchema).optional().default([]),

  isActive: z.boolean().optional().default(true),
})

const updateSystemRoleSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'access.role.validation.codeRequired')
      .max(50, 'access.role.validation.codeTooLong')
      .optional(),

    displayName: z
      .string()
      .trim()
      .min(1, 'access.role.validation.displayNameRequired')
      .max(100, 'access.role.validation.displayNameTooLong')
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
      message: 'access.role.validation.updatePayloadRequired',
    },
  )

module.exports = {
  listSystemRoleQuerySchema,
  createSystemRoleSchema,
  updateSystemRoleSchema,
}