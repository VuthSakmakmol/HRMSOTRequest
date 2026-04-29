// backend/src/modules/ot/validators/shiftOtOption.validation.js
const { z } = require('zod')

function s(value) {
  return String(value ?? '').trim()
}

function toBool(value) {
  if (typeof value === 'boolean') return value

  const text = s(value).toLowerCase()

  if (text === 'true') return true
  if (text === 'false') return false
  if (text === '1') return true
  if (text === '0') return false
  if (text === 'yes') return true
  if (text === 'no') return false

  return value
}

function toInt(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback

  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function normalizeSortOrder(value, fallback = 1) {
  if (value === '' || value === null || value === undefined) return fallback
  if (value === 1 || value === '1' || value === 'asc') return 1
  if (value === -1 || value === '-1' || value === 'desc') return -1

  return fallback
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')

const optionalObjectIdSchema = z
  .string()
  .trim()
  .default('')
  .refine((value) => !value || /^[a-fA-F0-9]{24}$/.test(value), {
    message: 'Invalid id',
  })

const createShiftOTOptionSchema = z.object({
  shiftId: objectIdSchema,

  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(100, 'Label must not exceed 100 characters'),

  requestedMinutes: z.coerce
    .number()
    .int('Requested minutes must be an integer')
    .min(1, 'Requested minutes must be at least 1'),

  calculationPolicyId: objectIdSchema,

  sequence: z.coerce
    .number()
    .int('Sequence must be an integer')
    .min(1, 'Sequence must be at least 1')
    .default(1),

  isActive: z.preprocess(toBool, z.boolean().optional()).default(true),
})

const updateShiftOTOptionSchema = createShiftOTOptionSchema
  .partial()
  .refine((value) => Object.keys(value || {}).length > 0, {
    message: 'At least one field is required',
  })

const listShiftOTOptionsQuerySchema = z
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

    shiftId: optionalObjectIdSchema,

    calculationPolicyId: optionalObjectIdSchema,

    isActive: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined
        return toBool(value)
      },
      z.boolean().optional(),
    ),

    sortField: z
      .enum(['createdAt', 'updatedAt', 'label', 'requestedMinutes', 'sequence', 'isActive'])
      .optional(),

    // Backward compatibility with current frontend.
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'label', 'requestedMinutes', 'sequence', 'isActive'])
      .optional(),

    sortOrder: z.preprocess(
      (value) => normalizeSortOrder(value, 1),
      z.union([z.literal(1), z.literal(-1)]).default(1),
    ),
  })
  .transform((value) => ({
    ...value,
    sortField: value.sortField || value.sortBy || 'sequence',
  }))

const lookupShiftOTOptionsQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  limit: z.preprocess(
    (value) => toInt(value, 20),
    z.number().int().min(1).max(50).default(20),
  ),

  shiftId: optionalObjectIdSchema,

  calculationPolicyId: optionalObjectIdSchema,

  isActive: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return true
      return toBool(value)
    },
    z.boolean().optional().default(true),
  ),
})

const shiftOTOptionIdParamSchema = z.object({
  id: objectIdSchema,
})

module.exports = {
  objectIdSchema,
  createShiftOTOptionSchema,
  updateShiftOTOptionSchema,
  listShiftOTOptionsQuerySchema,
  lookupShiftOTOptionsQuerySchema,
  shiftOTOptionIdParamSchema,
}