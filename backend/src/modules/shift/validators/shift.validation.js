// backend/src/modules/shift/validators/shift.validation.js
const mongoose = require('mongoose')
const { z } = require('zod')

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'code',
  'name',
  'type',
  'startTime',
  'endTime',
  'isActive',
]

function toBool(value) {
  if (typeof value === 'boolean') return value

  const text = String(value ?? '').trim().toLowerCase()

  if (text === 'true') return true
  if (text === 'false') return false

  return value
}

function toInt(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback

  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeSortOrder(value) {
  if (value === 1 || value === '1' || value === 'asc') return 1
  return -1
}

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: 'Invalid shift id',
  })

const shiftTypeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => ['DAY', 'NIGHT'].includes(value), {
    message: 'Shift type must be DAY or NIGHT',
  })

const createShiftSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Shift code is required')
    .max(30, 'Shift code must be at most 30 characters')
    .transform((value) => value.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'Shift name is required')
    .max(120, 'Shift name must be at most 120 characters'),

  type: shiftTypeSchema,

  startTime: z
    .string()
    .trim()
    .regex(HHMM_REGEX, 'Start time must be in HH:mm format'),

  breakStartTime: z
    .string()
    .trim()
    .regex(HHMM_REGEX, 'Break start time must be in HH:mm format'),

  breakEndTime: z
    .string()
    .trim()
    .regex(HHMM_REGEX, 'Break end time must be in HH:mm format'),

  endTime: z
    .string()
    .trim()
    .regex(HHMM_REGEX, 'End time must be in HH:mm format'),

  isActive: z.preprocess(toBool, z.boolean().optional()).default(true),
})

const updateShiftSchema = createShiftSchema.partial().refine(
  (value) => Object.keys(value || {}).length > 0,
  {
    message: 'At least one field is required',
  },
)

const sortFieldSchema = z.enum(SORT_FIELDS)

const listShiftQuerySchema = z
  .object({
    page: z.preprocess(
      (value) => toInt(value, 1),
      z.number().int().min(1).default(1),
    ),

    limit: z.preprocess(
      (value) => toInt(value, 10),
      z.number().int().min(1).max(100).default(10),
    ),

    search: z.string().trim().optional().default(''),

    type: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined
        return String(value).trim().toUpperCase()
      },
      shiftTypeSchema.optional(),
    ),

    isActive: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined
        return toBool(value)
      },
      z.boolean().optional(),
    ),

    sortField: sortFieldSchema.optional(),
    sortBy: sortFieldSchema.optional(),

    sortOrder: z.preprocess(
      normalizeSortOrder,
      z.union([z.literal(1), z.literal(-1)]).default(-1),
    ),
  })
  .transform((value) => ({
    ...value,
    sortField: value.sortField || value.sortBy || 'createdAt',
  }))

module.exports = {
  objectIdSchema,
  createShiftSchema,
  updateShiftSchema,
  listShiftQuerySchema,
}