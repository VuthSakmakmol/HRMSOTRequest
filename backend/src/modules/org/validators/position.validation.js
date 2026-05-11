// backend/src/modules/org/validators/position.validation.js

const { z } = require('zod')
const mongoose = require('mongoose')

const POSITION_HIERARCHY_SCOPE = ['SAME_LINE', 'GLOBAL', 'CROSS_DEPARTMENT']

function s(value) {
  return String(value ?? '').trim()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toBooleanString(value) {
  if (value === '' || value === undefined || value === null) return ''
  if (value === true || value === 'true') return 'true'
  if (value === false || value === 'false') return 'false'
  return ''
}

function optionalObjectIdValue() {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => !value || isObjectId(value), {
      message: 'common.validation.invalidId',
    })
}

function optionalCodeValue(max = 50) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value).toUpperCase())
    .refine((value) => value.length <= max, {
      message: 'common.validation.tooLong',
    })
}

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const positionIdParamSchema = z.object({
  id: objectIdSchema,
})

const createPositionSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'org.position.validation.codeMinLength')
    .max(50, 'org.position.validation.codeTooLong')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(2, 'org.position.validation.nameMinLength')
    .max(150, 'org.position.validation.nameTooLong'),

  description: z
    .string()
    .trim()
    .max(1000, 'org.position.validation.descriptionTooLong')
    .optional()
    .default(''),

  departmentId: optionalObjectIdValue().optional().default(''),
  departmentCode: optionalCodeValue(50).optional().default(''),

  reportsToPositionId: optionalObjectIdValue().optional().default(''),
  reportsToPositionCode: optionalCodeValue(50).optional().default(''),

  hierarchyScope: z
    .enum(POSITION_HIERARCHY_SCOPE)
    .optional()
    .default('SAME_LINE'),

  level: z.coerce.number().int().min(0).optional().default(0),

  isActive: z.boolean().optional().default(true),
})

const updatePositionSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'org.position.validation.codeMinLength')
      .max(50, 'org.position.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(2, 'org.position.validation.nameMinLength')
      .max(150, 'org.position.validation.nameTooLong')
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000, 'org.position.validation.descriptionTooLong')
      .optional(),

    departmentId: optionalObjectIdValue().optional(),
    departmentCode: optionalCodeValue(50).optional(),

    reportsToPositionId: optionalObjectIdValue().optional(),
    reportsToPositionCode: optionalCodeValue(50).optional(),

    hierarchyScope: z.enum(POSITION_HIERARCHY_SCOPE).optional(),

    level: z.coerce.number().int().min(0).optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.departmentId !== undefined ||
      value.departmentCode !== undefined ||
      value.reportsToPositionId !== undefined ||
      value.reportsToPositionCode !== undefined ||
      value.hierarchyScope !== undefined ||
      value.level !== undefined ||
      value.isActive !== undefined,
    {
      message: 'org.position.validation.updatePayloadRequired',
    },
  )

const listPositionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(toBooleanString),

  departmentId: optionalObjectIdValue().optional().default(''),
  departmentCode: optionalCodeValue(50).optional().default(''),

  reportsToPositionId: optionalObjectIdValue().optional().default(''),
  reportsToPositionCode: optionalCodeValue(50).optional().default(''),

  hierarchyScope: z
    .enum(POSITION_HIERARCHY_SCOPE)
    .optional()
    .or(z.literal(''))
    .default(''),

  sortField: z
    .enum([
      'code',
      'name',
      'departmentName',
      'reportsToPositionName',
      'hierarchyScope',
      'level',
      'isActive',
      'createdAt',
      'updatedAt',
    ])
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

const lookupPositionsQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  isActive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
      const result = toBooleanString(value)
      return result || 'true'
    }),

  departmentId: optionalObjectIdValue().optional().default(''),
  departmentCode: optionalCodeValue(50).optional().default(''),

  hierarchyScope: z
    .enum(POSITION_HIERARCHY_SCOPE)
    .optional()
    .or(z.literal(''))
    .default(''),

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

module.exports = {
  objectIdSchema,
  positionIdParamSchema,
  createPositionSchema,
  updatePositionSchema,
  listPositionsQuerySchema,
  lookupPositionsQuerySchema,
  POSITION_HIERARCHY_SCOPE,
}