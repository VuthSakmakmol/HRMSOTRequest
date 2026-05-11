// backend/src/modules/org/validators/productionLine.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

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

const listProductionLineQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  departmentId: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((value) => !value || isObjectId(value), 'org.line.field.departmentId.invalid'),

  isActive: booleanLike,

  sortField: z
    .enum(['code', 'name', 'isActive', 'createdAt', 'updatedAt'])
    .optional()
    .default('code'),

  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === -1 || value === '-1' || value === 'desc') return -1
      if (value === 1 || value === '1' || value === 'asc') return 1
      return 1
    }),
})

const productionLineLookupQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  departmentId: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine((value) => !value || isObjectId(value), 'org.line.field.departmentId.invalid'),

  isActive: booleanLike,

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const createProductionLineSchema = z.object({
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

  departmentId: objectIdField('org.line.field.departmentId'),

  positionIds: objectIdArrayField('org.line.field.positionIds'),

  description: z
    .string()
    .trim()
    .max(500, 'org.line.validation.descriptionTooLong')
    .optional()
    .default(''),

  isActive: z.boolean().optional().default(true),
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

    departmentId: objectIdField('org.line.field.departmentId').optional(),

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
      value.positionIds !== undefined ||
      value.description !== undefined ||
      value.isActive !== undefined,
    {
      message: 'org.line.validation.updatePayloadRequired',
    },
  )

const importProductionLineRowSchema = z.object({
  lineId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => !value || isObjectId(value), 'org.line.validation.lineIdInvalid'),

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

  departmentId: objectIdField('org.line.field.departmentId'),

  positionIds: objectIdArrayField('org.line.field.positionIds'),

  description: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => value.length <= 500, 'org.line.validation.descriptionTooLong'),

  isActive: z
    .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => toBoolean(value, true))
    .refine((value) => typeof value === 'boolean', 'org.line.validation.isActiveInvalid'),
})

function normalizeListQuery(raw = {}) {
  const parsed = listProductionLineQuerySchema.parse(raw)

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
  const parsed = productionLineLookupQuerySchema.parse(raw)

  return {
    search: parsed.search,
    departmentId: parsed.departmentId,
    isActive: toBoolean(parsed.isActive, true),
    limit: parsed.limit,
  }
}

module.exports = {
  createProductionLineSchema,
  updateProductionLineSchema,
  listProductionLineQuerySchema,
  productionLineLookupQuerySchema,
  importProductionLineRowSchema,
  normalizeListQuery,
  normalizeLookupQuery,
}