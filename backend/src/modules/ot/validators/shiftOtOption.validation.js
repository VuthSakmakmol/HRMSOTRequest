// backend/src/modules/ot/validators/shiftOtOption.validation.js
const { z } = require('zod')

const SHIFT_OT_OPTION_TIMING_MODES = ['AFTER_SHIFT_END', 'FIXED_TIME']
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

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

const timingModeSchema = z.preprocess(
  (value) => {
    const text = s(value)
    return text ? text.toUpperCase() : 'AFTER_SHIFT_END'
  },
  z.enum(SHIFT_OT_OPTION_TIMING_MODES),
)

const optionalTimingModeSchema = z.preprocess(
  (value) => {
    const text = s(value)
    if (!text) return undefined
    return text.toUpperCase()
  },
  z.enum(SHIFT_OT_OPTION_TIMING_MODES).optional(),
)

const optionalHHMMTimeSchema = z.preprocess(
  (value) => {
    const text = s(value)
    return text || ''
  },
  z.string().trim(),
)

/**
 * Keep this as a plain ZodObject.
 * Do NOT put .superRefine() directly here because update schema needs .partial().
 */
const shiftOTOptionBaseSchema = z.object({
  shiftId: objectIdSchema,

  label: z
    .string()
    .trim()
    .min(1, 'Label is required')
    .max(100, 'Label must not exceed 100 characters'),

  timingMode: timingModeSchema.default('AFTER_SHIFT_END'),

  startAfterShiftEndMinutes: z.coerce
    .number()
    .int('Start after shift end minutes must be an integer')
    .min(0, 'Start after shift end minutes must be at least 0')
    .default(0),

  fixedStartTime: optionalHHMMTimeSchema.default(''),
  fixedEndTime: optionalHHMMTimeSchema.default(''),

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

function validateTimingRules(data, ctx, { isUpdate = false } = {}) {
  const timingMode = s(data.timingMode || '').toUpperCase()

  /**
   * For update payloads, if timingMode is not included, do not force timing validation here.
   * The service/model will validate final saved document after merge.
   */
  if (isUpdate && !timingMode) return

  if (timingMode === 'AFTER_SHIFT_END') {
    data.fixedStartTime = ''
    data.fixedEndTime = ''
    return
  }

  if (timingMode === 'FIXED_TIME') {
    data.startAfterShiftEndMinutes = 0

    if (!HHMM_REGEX.test(s(data.fixedStartTime))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedStartTime'],
        message: 'Fixed start time must be in HH:mm format',
      })
    }

    if (!HHMM_REGEX.test(s(data.fixedEndTime))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedEndTime'],
        message: 'Fixed end time must be in HH:mm format',
      })
    }

    if (
      HHMM_REGEX.test(s(data.fixedStartTime)) &&
      HHMM_REGEX.test(s(data.fixedEndTime)) &&
      s(data.fixedStartTime) === s(data.fixedEndTime)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedEndTime'],
        message: 'Fixed start time and fixed end time cannot be the same',
      })
    }
  }
}

const createShiftOTOptionSchema = shiftOTOptionBaseSchema.superRefine((data, ctx) => {
  validateTimingRules(data, ctx, { isUpdate: false })
})

const updateShiftOTOptionSchema = shiftOTOptionBaseSchema
  .partial()
  .refine((value) => Object.keys(value || {}).length > 0, {
    message: 'At least one field is required',
  })
  .superRefine((data, ctx) => {
    validateTimingRules(data, ctx, { isUpdate: true })
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

    timingMode: optionalTimingModeSchema,

    isActive: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined
        return toBool(value)
      },
      z.boolean().optional(),
    ),

    sortField: z
      .enum([
        'createdAt',
        'updatedAt',
        'label',
        'timingMode',
        'requestedMinutes',
        'startAfterShiftEndMinutes',
        'sequence',
        'isActive',
      ])
      .optional(),

    sortBy: z
      .enum([
        'createdAt',
        'updatedAt',
        'label',
        'timingMode',
        'requestedMinutes',
        'startAfterShiftEndMinutes',
        'sequence',
        'isActive',
      ])
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

  timingMode: optionalTimingModeSchema,

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
  SHIFT_OT_OPTION_TIMING_MODES,
}