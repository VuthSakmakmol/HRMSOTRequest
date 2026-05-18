// backend/src/modules/org/validators/productionLine.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

function s(value) {
  return String(value ?? '').trim()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null || value === 'all') return ''
  if (value === true || value === 'true' || value === 1 || value === '1') return 'true'
  if (value === false || value === 'false' || value === 0 || value === '0') return 'false'

  const text = String(value).trim().toLowerCase()

  if (['yes', 'y', 'active'].includes(text)) return 'true'
  if (['no', 'n', 'inactive'].includes(text)) return 'false'

  return ''
}

const objectIdField = (fieldKey) =>
  z
    .string()
    .trim()
    .min(1, `${fieldKey}.required`)
    .refine((value) => isObjectId(value), `${fieldKey}.invalid`)

const optionalObjectIdField = (fieldKey) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => !value || isObjectId(value), `${fieldKey}.invalid`)

const objectIdArrayField = (fieldKey) =>
  z
    .array(
      z
        .string()
        .trim()
        .refine((value) => isObjectId(value), `${fieldKey}.invalid`),
    )
    .optional()
    .default([])

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

function hasAnyDepartment(value = {}) {
  return !!s(value.departmentId) || uniqueStrings(value.departmentIds).length > 0
}

const listProductionLineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  departmentId: optionalObjectIdField('org.line.field.departmentId')
    .optional()
    .default(''),

  isActive: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .transform(toBooleanString),

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

const productionLineLookupQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  departmentId: optionalObjectIdField('org.line.field.departmentId')
    .optional()
    .default(''),

  isActive: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .transform((value) => {
      const result = toBooleanString(value)
      return result || 'true'
    }),

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const createProductionLineSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'org.line.validation.codeRequired')
      .max(50, 'org.line.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase()),

    name: z
      .string()
      .trim()
      .min(1, 'org.line.validation.nameRequired')
      .max(120, 'org.line.validation.nameTooLong'),

    // Legacy single department support.
    departmentId: optionalObjectIdField('org.line.field.departmentId')
      .optional()
      .default(''),

    // New multi-department support.
    departmentIds: objectIdArrayField('org.line.field.departmentIds'),

    positionIds: objectIdArrayField('org.line.field.positionIds'),

    description: z
      .string()
      .trim()
      .max(500, 'org.line.validation.descriptionTooLong')
      .optional()
      .default(''),

    isActive: z.boolean().optional().default(true),
  })
  .refine(hasAnyDepartment, {
    message: 'org.line.validation.departmentRequired',
    path: ['departmentIds'],
  })

const updateProductionLineSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'org.line.validation.codeRequired')
      .max(50, 'org.line.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, 'org.line.validation.nameRequired')
      .max(120, 'org.line.validation.nameTooLong')
      .optional(),

    // Legacy single department support.
    departmentId: optionalObjectIdField('org.line.field.departmentId').optional(),

    // New multi-department support.
    departmentIds: objectIdArrayField('org.line.field.departmentIds').optional(),

    positionIds: objectIdArrayField('org.line.field.positionIds').optional(),

    description: z
      .string()
      .trim()
      .max(500, 'org.line.validation.descriptionTooLong')
      .optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.departmentId !== undefined ||
      value.departmentIds !== undefined ||
      value.positionIds !== undefined ||
      value.description !== undefined ||
      value.isActive !== undefined,
    {
      message: 'org.line.validation.updatePayloadRequired',
    },
  )
  .refine(
    (value) => {
      if (value.departmentId === undefined && value.departmentIds === undefined) {
        return true
      }

      return hasAnyDepartment(value)
    },
    {
      message: 'org.line.validation.departmentRequired',
      path: ['departmentIds'],
    },
  )

function normalizeListQuery(raw = {}) {
  const parsed = listProductionLineQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    departmentId: parsed.departmentId,
    isActive: parsed.isActive,
    sortField: parsed.sortField,
    sortOrder: parsed.sortOrder,
  }
}

function normalizeLookupQuery(raw = {}) {
  const parsed = productionLineLookupQuerySchema.parse(raw)

  return {
    search: parsed.search,
    departmentId: parsed.departmentId,
    isActive: parsed.isActive,
    limit: parsed.limit,
  }
}

module.exports = {
  createProductionLineSchema,
  updateProductionLineSchema,
  listProductionLineQuerySchema,
  productionLineLookupQuerySchema,
  normalizeListQuery,
  normalizeLookupQuery,
}