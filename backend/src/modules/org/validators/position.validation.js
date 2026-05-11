// backend/src/modules/org/validators/position.validation.js

const { z } = require('zod')

const POSITION_HIERARCHY_SCOPE = ['SAME_LINE', 'GLOBAL', 'CROSS_DEPARTMENT']

const POSITION_SORT_FIELDS = [
  'code',
  'name',
  'departmentName',
  'reportsToPositionName',
  'hierarchyScope',
  'level',
  'isActive',
  'createdAt',
  'updatedAt',
]

function s(value) {
  return String(value ?? '').trim()
}

function normalizeUpperOptional(value) {
  if (typeof value === 'undefined') return undefined
  const raw = s(value)
  return raw ? raw.toUpperCase() : ''
}

function requiredUpperString(label, max = 50) {
  return z.preprocess(
    (value) => s(value).toUpperCase(),
    z
      .string({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be text`,
      })
      .trim()
      .min(1, `${label} is required`)
      .max(max, `${label} is too long`),
  )
}

function requiredText(label, max = 150) {
  return z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`,
    })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
}

function optionalText(max = 500) {
  return z.preprocess(
    (value) => {
      if (typeof value === 'undefined') return undefined
      return s(value)
    },
    z.string().max(max).optional(),
  )
}

function optionalUpperText(max = 100) {
  return z.preprocess(
    (value) => normalizeUpperOptional(value),
    z.string().max(max).optional(),
  )
}

function optionalUpperEnum(values) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.enum(values).optional(),
  )
}

function optionalBoolean() {
  return z.preprocess(
    (value) => {
      if (typeof value === 'undefined') return undefined

      const raw = s(value).toLowerCase()

      if (!raw) return undefined
      if (value === true || raw === 'true' || raw === '1' || raw === 'yes') return true
      if (value === false || raw === 'false' || raw === '0' || raw === 'no') return false

      return value
    },
    z.boolean().optional(),
  )
}

const pageSchema = z.coerce.number().int().min(1).default(1)
const limitSchema = z.coerce.number().int().min(1).max(200).default(10)
const sortOrderSchema = z.enum(['asc', 'desc']).default('desc')

const createPositionSchema = z.object({
  code: requiredUpperString('Code', 50),
  name: requiredText('Name', 150),
  description: optionalText(1000).default(''),

  departmentCode: optionalUpperText(50).default(''),
  reportsToPositionCode: optionalUpperText(50).default(''),

  hierarchyScope: optionalUpperEnum(POSITION_HIERARCHY_SCOPE).default('SAME_LINE'),
  level: z.coerce.number().int().min(0).optional().default(0),

  isActive: z.boolean().optional().default(true),
})

const updatePositionSchema = z
  .object({
    code: optionalUpperText(50),
    name: optionalText(150),
    description: optionalText(1000),

    departmentCode: optionalUpperText(50),
    reportsToPositionCode: optionalUpperText(50),

    hierarchyScope: optionalUpperEnum(POSITION_HIERARCHY_SCOPE),
    level: z.coerce.number().int().min(0).optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

const listPositionsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: optionalText(200).default(''),
  isActive: optionalBoolean(),

  departmentCode: optionalUpperText(50),
  reportsToPositionCode: optionalUpperText(50),
  hierarchyScope: optionalUpperEnum(POSITION_HIERARCHY_SCOPE),

  sortBy: z.preprocess(
    (value) => {
      const raw = s(value)
      return raw || undefined
    },
    z.enum(POSITION_SORT_FIELDS).optional().default('createdAt'),
  ),

  sortOrder: sortOrderSchema,
})

const lookupPositionsQuerySchema = z.object({
  search: optionalText(200).default(''),
  isActive: optionalBoolean().default(true),
  departmentCode: optionalUpperText(50),
  hierarchyScope: optionalUpperEnum(POSITION_HIERARCHY_SCOPE),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const positionCodeParamSchema = z.object({
  code: requiredUpperString('Position code', 50),
})

module.exports = {
  createPositionSchema,
  updatePositionSchema,
  listPositionsQuerySchema,
  lookupPositionsQuerySchema,
  positionCodeParamSchema,

  POSITION_HIERARCHY_SCOPE,
  POSITION_SORT_FIELDS,
}