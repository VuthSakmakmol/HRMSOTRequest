// backend/src/modules/org/validators/position.validation.js
const { z } = require('zod')
const mongoose = require('mongoose')

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

function toBoolean(value, defaultValue = undefined) {
  if (value === undefined) return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const v = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(v)) return true
  if (['false', '0', 'no', 'n'].includes(v)) return false
  return defaultValue
}

const objectIdField = z
  .string()
  .trim()
  .min(1, 'Department is required')
  .refine(isObjectId, 'Invalid departmentId')

const optionalObjectIdFilter = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || isObjectId(value), 'Invalid departmentId')

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  departmentId: optionalObjectIdFilter,
  isActive: booleanLike,
  sortBy: z.enum(['createdAt', 'code', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const createPositionSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50, 'Code is too long'),
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  departmentId: objectIdField,
  description: z.string().trim().max(500, 'Description is too long').optional().default(''),
  isActive: z.boolean().optional().default(true),
})

const updatePositionSchema = z
  .object({
    code: z.string().trim().min(1, 'Code is required').max(50, 'Code is too long').optional(),
    name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long').optional(),
    departmentId: objectIdField.optional(),
    description: z.string().trim().max(500, 'Description is too long').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

function normalizeListQuery(raw = {}) {
  const parsed = paginationQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    departmentId: parsed.departmentId,
    isActive: toBoolean(parsed.isActive),
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  }
}

module.exports = {
  createPositionSchema,
  updatePositionSchema,
  normalizeListQuery,
}