// backend/src/modules/org/validators/position.validation.js

const { z } = require('zod')
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toBoolean(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const text = String(value).trim().toLowerCase()

  if (['true', '1', 'yes', 'y', 'active'].includes(text)) return true
  if (['false', '0', 'no', 'n', 'inactive'].includes(text)) return false

  return defaultValue
}

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

const objectIdField = (fieldKey) =>
  z
    .string()
    .trim()
    .min(1, `${fieldKey}.required`)
    .refine((value) => isObjectId(value), `${fieldKey}.invalid`)

const optionalObjectIdField = (fieldKey) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return null

      const text = s(value)

      return text || null
    })
    .refine((value) => value === null || isObjectId(value), `${fieldKey}.invalid`)

const managerScopeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const scope = s(value || 'SAME_LINE').toUpperCase()

    return ['SAME_LINE', 'GLOBAL'].includes(scope) ? scope : 'SAME_LINE'
  })

const listPositionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  departmentId: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((value) => !value || isObjectId(value), 'org.position.field.departmentId.invalid'),

  isActive: booleanLike,

  sortField: z
    .enum(['code', 'name', 'isActive', 'createdAt', 'updatedAt'])
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

const positionLookupQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  departmentId: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((value) => !value || isObjectId(value), 'org.position.field.departmentId.invalid'),

  isActive: booleanLike,

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const createPositionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'org.position.validation.codeRequired')
    .max(50, 'org.position.validation.codeTooLong')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'org.position.validation.nameRequired')
    .max(120, 'org.position.validation.nameTooLong'),

  departmentId: objectIdField('org.position.field.departmentId'),

  reportsToPositionId: optionalObjectIdField(
    'org.position.field.reportsToPositionId',
  ).default(null),

  managerScope: managerScopeField.default('SAME_LINE'),

  description: z
    .string()
    .trim()
    .max(500, 'org.position.validation.descriptionTooLong')
    .optional()
    .default(''),

  isActive: z.boolean().optional().default(true),
})

const updatePositionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'org.position.validation.codeRequired')
      .max(50, 'org.position.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, 'org.position.validation.nameRequired')
      .max(120, 'org.position.validation.nameTooLong')
      .optional(),

    departmentId: objectIdField('org.position.field.departmentId').optional(),

    reportsToPositionId: optionalObjectIdField(
      'org.position.field.reportsToPositionId',
    ).optional(),

    managerScope: managerScopeField.optional(),

    description: z
      .string()
      .trim()
      .max(500, 'org.position.validation.descriptionTooLong')
      .optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.departmentId !== undefined ||
      value.reportsToPositionId !== undefined ||
      value.managerScope !== undefined ||
      value.description !== undefined ||
      value.isActive !== undefined,
    {
      message: 'org.position.validation.updatePayloadRequired',
    },
  )

const importPositionRowSchema = z.object({
  positionId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => !value || isObjectId(value), 'org.position.validation.positionIdInvalid'),

  departmentId: objectIdField('org.position.field.departmentId'),

  code: z
    .string()
    .trim()
    .min(1, 'org.position.validation.codeRequired')
    .max(50, 'org.position.validation.codeTooLong')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'org.position.validation.nameRequired')
    .max(120, 'org.position.validation.nameTooLong'),

  reportsToPositionId: optionalObjectIdField(
    'org.position.field.reportsToPositionId',
  ).default(null),

  managerScope: managerScopeField.default('SAME_LINE'),

  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => value.length <= 500, 'org.position.validation.descriptionTooLong'),

  isActive: z
    .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => toBoolean(value, true))
    .refine((value) => typeof value === 'boolean', 'org.position.validation.isActiveInvalid'),
})

function normalizeListQuery(raw = {}) {
  const parsed = listPositionQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    departmentId: parsed.departmentId,
    isActive: toBoolean(parsed.isActive),
    sortField: parsed.sortField,
    sortOrder: parsed.sortOrder,
  }
}

function normalizeLookupQuery(raw = {}) {
  const parsed = positionLookupQuerySchema.parse(raw)

  return {
    search: parsed.search,
    departmentId: parsed.departmentId,
    isActive: toBoolean(parsed.isActive, true),
    limit: parsed.limit,
  }
}

module.exports = {
  createPositionSchema,
  updatePositionSchema,
  importPositionRowSchema,
  normalizeListQuery,
  normalizeLookupQuery,
}