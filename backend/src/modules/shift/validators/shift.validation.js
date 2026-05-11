// backend/src/modules/shift/validators/shift.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

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

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const shiftTypeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => s(value).toUpperCase())
  .refine((value) => ['DAY', 'NIGHT'].includes(value), 'shift.validation.typeInvalid')

const timeField = (messageKey) =>
  z
    .string()
    .trim()
    .regex(HHMM_REGEX, messageKey)

const createShiftSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'shift.validation.codeRequired')
    .max(30, 'shift.validation.codeTooLong')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'shift.validation.nameRequired')
    .max(120, 'shift.validation.nameTooLong'),

  type: shiftTypeField,

  startTime: timeField('shift.validation.startTimeInvalid'),
  breakStartTime: timeField('shift.validation.breakStartTimeInvalid'),
  breakEndTime: timeField('shift.validation.breakEndTimeInvalid'),
  endTime: timeField('shift.validation.endTimeInvalid'),

  isActive: z.boolean().optional().default(true),
})

const updateShiftSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'shift.validation.codeRequired')
      .max(30, 'shift.validation.codeTooLong')
      .transform((value) => s(value).toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, 'shift.validation.nameRequired')
      .max(120, 'shift.validation.nameTooLong')
      .optional(),

    type: shiftTypeField.optional(),

    startTime: timeField('shift.validation.startTimeInvalid').optional(),
    breakStartTime: timeField('shift.validation.breakStartTimeInvalid').optional(),
    breakEndTime: timeField('shift.validation.breakEndTimeInvalid').optional(),
    endTime: timeField('shift.validation.endTimeInvalid').optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.type !== undefined ||
      value.startTime !== undefined ||
      value.breakStartTime !== undefined ||
      value.breakEndTime !== undefined ||
      value.endTime !== undefined ||
      value.isActive !== undefined,
    {
      message: 'shift.validation.updatePayloadRequired',
    },
  )

const listShiftQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  type: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((value) => s(value).toUpperCase())
    .refine((value) => !value || ['DAY', 'NIGHT'].includes(value), 'shift.validation.typeInvalid'),

  isActive: booleanLike,

  sortField: z
    .enum([
      'createdAt',
      'updatedAt',
      'code',
      'name',
      'type',
      'startTime',
      'endTime',
      'isActive',
    ])
    .optional()
    .default('createdAt'),

  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'code',
      'name',
      'type',
      'startTime',
      'endTime',
      'isActive',
    ])
    .optional(),

  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === 1 || value === '1' || value === 'asc') return 1
      if (value === -1 || value === '-1' || value === 'desc') return -1
      return -1
    }),
})

const shiftLookupQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  type: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((value) => s(value).toUpperCase())
    .refine((value) => !value || ['DAY', 'NIGHT'].includes(value), 'shift.validation.typeInvalid'),

  isActive: booleanLike,

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const importShiftRowSchema = z.object({
  shiftId: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => !value || isObjectId(value), 'shift.validation.shiftIdInvalid'),

  code: z
    .string()
    .trim()
    .min(1, 'shift.validation.codeRequired')
    .max(30, 'shift.validation.codeTooLong')
    .transform((value) => s(value).toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'shift.validation.nameRequired')
    .max(120, 'shift.validation.nameTooLong'),

  type: shiftTypeField,

  startTime: timeField('shift.validation.startTimeInvalid'),
  breakStartTime: timeField('shift.validation.breakStartTimeInvalid'),
  breakEndTime: timeField('shift.validation.breakEndTimeInvalid'),
  endTime: timeField('shift.validation.endTimeInvalid'),

  isActive: z
    .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => toBoolean(value, true))
    .refine((value) => typeof value === 'boolean', 'shift.validation.isActiveInvalid'),
})

function normalizeListQuery(raw = {}) {
  const parsed = listShiftQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    type: parsed.type,
    isActive: toBoolean(parsed.isActive),
    sortField: parsed.sortBy || parsed.sortField || 'createdAt',
    sortOrder: parsed.sortOrder,
  }
}

function normalizeLookupQuery(raw = {}) {
  const parsed = shiftLookupQuerySchema.parse(raw)

  return {
    search: parsed.search,
    type: parsed.type,
    isActive: toBoolean(parsed.isActive, true),
    limit: parsed.limit,
  }
}

module.exports = {
  objectIdSchema,
  createShiftSchema,
  updateShiftSchema,
  importShiftRowSchema,
  normalizeListQuery,
  normalizeLookupQuery,
}