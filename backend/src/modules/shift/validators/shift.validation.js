// backend/src/modules/shift/validators/shift.validation.js
const { z } = require('zod')

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

function toBool(value) {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

function toInt(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : value
}

const createShiftSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Shift code is required')
    .max(30, 'Shift code must be at most 30 characters')
    .transform((v) => v.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'Shift name is required')
    .max(120, 'Shift name must be at most 120 characters'),

  type: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(['DAY', 'NIGHT'], 'Shift type must be DAY or NIGHT')),

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

const updateShiftSchema = createShiftSchema.partial()

const listShiftQuerySchema = z.object({
  page: z.preprocess(
    (v) => toInt(v, 1),
    z.number().int().min(1).default(1),
  ),
  limit: z.preprocess(
    (v) => toInt(v, 10),
    z.number().int().min(1).max(100).default(10),
  ),
  search: z.string().trim().optional().default(''),
  type: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : String(v).trim().toUpperCase()),
      z.enum(['DAY', 'NIGHT']).optional(),
    ),
  isActive: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined
      return toBool(v)
    },
    z.boolean().optional(),
  ),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'code', 'name', 'type', 'startTime', 'endTime'])
    .optional()
    .default('createdAt'),
  sortOrder: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
})

module.exports = {
  createShiftSchema,
  updateShiftSchema,
  listShiftQuerySchema,
}