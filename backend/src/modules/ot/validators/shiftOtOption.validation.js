// backend/src/modules/ot/validators/shiftOtOption.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

const SHIFT_OT_OPTION_TIMING_MODES = ['AFTER_SHIFT_END', 'FIXED_TIME']
const SHIFT_OT_OPTION_DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
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

function normalizeDayTypeArray(value) {
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    const text = s(value)
    if (!text) return ['WORKING_DAY']

    return text
      .split(',')
      .map((item) => s(item))
      .filter(Boolean)
  }

  return ['WORKING_DAY']
}

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const optionalObjectIdSchema = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || isObjectId(value), 'common.validation.invalidId')

const timingModeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => upper(value || 'AFTER_SHIFT_END'))
  .refine(
    (value) => SHIFT_OT_OPTION_TIMING_MODES.includes(value),
    'ot.shiftOption.validation.timingModeInvalid',
  )

const optionalTimingModeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const text = upper(value)
    return text || undefined
  })
  .refine(
    (value) =>
      value === undefined || SHIFT_OT_OPTION_TIMING_MODES.includes(value),
    'ot.shiftOption.validation.timingModeInvalid',
  )
  .optional()

const dayTypeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => upper(value))
  .refine(
    (value) => SHIFT_OT_OPTION_DAY_TYPES.includes(value),
    'ot.shiftOption.validation.dayTypeInvalid',
  )

const optionalDayTypeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const text = upper(value)
    return text || undefined
  })
  .refine(
    (value) => value === undefined || SHIFT_OT_OPTION_DAY_TYPES.includes(value),
    'ot.shiftOption.validation.dayTypeInvalid',
  )
  .optional()

const applicableDayTypesField = z.preprocess(
  normalizeDayTypeArray,
  z
    .array(dayTypeField)
    .min(1, 'ot.shiftOption.validation.applicableDayTypesRequired')
    .max(3, 'ot.shiftOption.validation.applicableDayTypesTooMany'),
)

const optionalHHMMField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => s(value))

const createShiftOTOptionSchema = z
  .object({
    shiftId: objectIdSchema,

    label: z
      .string()
      .trim()
      .min(1, 'ot.shiftOption.validation.labelRequired')
      .max(100, 'ot.shiftOption.validation.labelTooLong'),

    timingMode: timingModeField.default('AFTER_SHIFT_END'),

    applicableDayTypes: applicableDayTypesField.default(['WORKING_DAY']),

    startAfterShiftEndMinutes: z.coerce
      .number()
      .int('ot.shiftOption.validation.startAfterShiftEndMinutesInvalid')
      .min(0, 'ot.shiftOption.validation.startAfterShiftEndMinutesInvalid')
      .default(0),

    fixedStartTime: optionalHHMMField.default(''),
    fixedEndTime: optionalHHMMField.default(''),

    requestedMinutes: z.coerce
      .number()
      .int('ot.shiftOption.validation.requestedMinutesInvalid')
      .min(1, 'ot.shiftOption.validation.requestedMinutesInvalid'),

    calculationPolicyId: objectIdSchema,

    sequence: z.coerce
      .number()
      .int('ot.shiftOption.validation.sequenceInvalid')
      .min(1, 'ot.shiftOption.validation.sequenceInvalid')
      .default(1),

    isActive: booleanLike.transform((value) => toBoolean(value, true)).default(true),
  })
  .superRefine((value, ctx) => {
    value.applicableDayTypes = [...new Set(value.applicableDayTypes.map(upper))]

    if (value.timingMode === 'AFTER_SHIFT_END') {
      value.fixedStartTime = ''
      value.fixedEndTime = ''
      return
    }

    if (value.timingMode === 'FIXED_TIME') {
      value.startAfterShiftEndMinutes = 0

      if (!HHMM_REGEX.test(value.fixedStartTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedStartTime'],
          message: 'ot.shiftOption.validation.fixedStartTimeInvalid',
        })
      }

      if (!HHMM_REGEX.test(value.fixedEndTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedEndTime'],
          message: 'ot.shiftOption.validation.fixedEndTimeInvalid',
        })
      }

      if (
        HHMM_REGEX.test(value.fixedStartTime) &&
        HHMM_REGEX.test(value.fixedEndTime) &&
        value.fixedStartTime === value.fixedEndTime
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixedEndTime'],
          message: 'ot.shiftOption.validation.fixedTimeSame',
        })
      }
    }
  })

const updateShiftOTOptionSchema = z
  .object({
    shiftId: objectIdSchema.optional(),

    label: z
      .string()
      .trim()
      .min(1, 'ot.shiftOption.validation.labelRequired')
      .max(100, 'ot.shiftOption.validation.labelTooLong')
      .optional(),

    timingMode: optionalTimingModeField,

    applicableDayTypes: applicableDayTypesField.optional(),

    startAfterShiftEndMinutes: z.coerce
      .number()
      .int('ot.shiftOption.validation.startAfterShiftEndMinutesInvalid')
      .min(0, 'ot.shiftOption.validation.startAfterShiftEndMinutesInvalid')
      .optional(),

    fixedStartTime: optionalHHMMField.optional(),
    fixedEndTime: optionalHHMMField.optional(),

    requestedMinutes: z.coerce
      .number()
      .int('ot.shiftOption.validation.requestedMinutesInvalid')
      .min(1, 'ot.shiftOption.validation.requestedMinutesInvalid')
      .optional(),

    calculationPolicyId: objectIdSchema.optional(),

    sequence: z.coerce
      .number()
      .int('ot.shiftOption.validation.sequenceInvalid')
      .min(1, 'ot.shiftOption.validation.sequenceInvalid')
      .optional(),

    isActive: booleanLike.transform((value) => toBoolean(value)).optional(),
  })
  .refine(
    (value) =>
      value.shiftId !== undefined ||
      value.label !== undefined ||
      value.timingMode !== undefined ||
      value.applicableDayTypes !== undefined ||
      value.startAfterShiftEndMinutes !== undefined ||
      value.fixedStartTime !== undefined ||
      value.fixedEndTime !== undefined ||
      value.requestedMinutes !== undefined ||
      value.calculationPolicyId !== undefined ||
      value.sequence !== undefined ||
      value.isActive !== undefined,
    {
      message: 'ot.shiftOption.validation.updatePayloadRequired',
    },
  )

const listShiftOTOptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  shiftId: optionalObjectIdSchema,

  calculationPolicyId: optionalObjectIdSchema,

  timingMode: optionalTimingModeField,

  dayType: optionalDayTypeField,

  otDate: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine(
      (value) => !value || YMD_REGEX.test(value),
      'calendar.holiday.validation.dateInvalid',
    ),

  isActive: booleanLike.transform((value) => toBoolean(value)).optional(),

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
    .optional()
    .default('sequence'),

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

  sortOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === 1 || value === '1' || value === 'asc') return 1
      if (value === -1 || value === '-1' || value === 'desc') return -1
      return 1
    }),
})

const lookupShiftOTOptionsQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  shiftId: optionalObjectIdSchema,

  calculationPolicyId: optionalObjectIdSchema,

  timingMode: optionalTimingModeField,

  dayType: optionalDayTypeField,

  otDate: z
    .string()
    .trim()
    .optional()
    .default('')
    .refine(
      (value) => !value || YMD_REGEX.test(value),
      'calendar.holiday.validation.dateInvalid',
    ),

  isActive: booleanLike.transform((value) => toBoolean(value, true)).optional(),

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const shiftOTOptionIdParamSchema = z.object({
  id: objectIdSchema,
})

function normalizeListQuery(raw = {}) {
  const parsed = listShiftOTOptionsQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    shiftId: parsed.shiftId,
    calculationPolicyId: parsed.calculationPolicyId,
    timingMode: parsed.timingMode,
    dayType: parsed.dayType,
    otDate: parsed.otDate,
    isActive: parsed.isActive,
    sortField: parsed.sortBy || parsed.sortField || 'sequence',
    sortOrder: parsed.sortOrder,
  }
}

function normalizeLookupQuery(raw = {}) {
  const parsed = lookupShiftOTOptionsQuerySchema.parse(raw)

  return {
    search: parsed.search,
    shiftId: parsed.shiftId,
    calculationPolicyId: parsed.calculationPolicyId,
    timingMode: parsed.timingMode,
    dayType: parsed.dayType,
    otDate: parsed.otDate,
    isActive: parsed.isActive,
    limit: parsed.limit,
  }
}

module.exports = {
  SHIFT_OT_OPTION_TIMING_MODES,
  SHIFT_OT_OPTION_DAY_TYPES,
  objectIdSchema,
  createShiftOTOptionSchema,
  updateShiftOTOptionSchema,
  normalizeListQuery,
  normalizeLookupQuery,
  shiftOTOptionIdParamSchema,
}