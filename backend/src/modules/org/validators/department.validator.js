// backend/src/modules/org/validators/department.validator.js
const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid department id')

const baseDepartmentSchema = {
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(30, 'Code must not exceed 30 characters')
    .transform((v) => v.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name must not exceed 120 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .default(''),
  isActive: z.boolean().optional().default(true),
}

const createDepartmentSchema = z.object(baseDepartmentSchema)

const updateDepartmentSchema = z
  .object({
    code: baseDepartmentSchema.code.optional(),
    name: baseDepartmentSchema.name.optional(),
    description: baseDepartmentSchema.description.optional(),
    isActive: baseDepartmentSchema.isActive.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

const listDepartmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().trim().optional().default(''),
  isActive: z
    .union([z.literal(''), z.literal('true'), z.literal('false')])
    .optional()
    .default(''),
  sortField: z
    .enum(['code', 'name', 'createdAt', 'isActive'])
    .optional()
    .default('createdAt'),
  sortOrder: z.coerce
    .number()
    .int()
    .refine((v) => v === 1 || v === -1, 'sortOrder must be 1 or -1')
    .optional()
    .default(-1),
})

module.exports = {
  objectIdSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentQuerySchema,
}