// backend/src/modules/ot/validators/otPolicy.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

const ROUND_METHODS = ['FLOOR', 'CEIL', 'NEAREST']

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

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

const objectIdSchema = z
  .string()
  .trim()
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const roundMethodField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => upper(value || 'CEIL'))
  .refine((value) => ROUND_METHODS.includes(value), 'ot.policy.validation.roundMethodInvalid')

const optionalRoundMethodField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const text = upper(value)
    return text || undefined
  })
  .refine(
    (value) => value === undefined || ROUND_METHODS.includes(value),
    'ot.policy.validation.roundMethodInvalid',
  )
  .optional()

const createOTCalculationPolicySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'ot.policy.validation.codeRequired')
    .max(50, 'ot.policy.validation.codeTooLong')
    .transform((value) => upper(value)),

  name: z
    .string()
    .trim()
    .min(1, 'ot.policy.validation.nameRequired')
    .max(150, 'ot.policy.validation.nameTooLong'),

  description: z
    .string()
    .trim()
    .max(1000, 'ot.policy.validation.descriptionTooLong')
    .optional()
    .default(''),

  minEligibleMinutes: z.coerce
    .number()
    .int('ot.policy.validation.minEligibleMinutesInvalid')
    .min(0, 'ot.policy.validation.minEligibleMinutesInvalid')
    .default(0),

  roundUnitMinutes: z.coerce
    .number()
    .int('ot.policy.validation.roundUnitMinutesInvalid')
    .min(1, 'ot.policy.validation.roundUnitMinutesInvalid')
    .default(30),

  roundMethod: roundMethodField.default('CEIL'),

  graceAfterShiftEndMinutes: z.coerce
    .number()
    .int('ot.policy.validation.graceAfterShiftEndMinutesInvalid')
    .min(0, 'ot.policy.validation.graceAfterShiftEndMinutesInvalid')
    .default(0),

  allowApprovedOtWithoutExactClockOut: booleanLike
    .transform((value) => toBoolean(value, false))
    .default(false),

  allowPreShiftOT: booleanLike.transform((value) => toBoolean(value, false)).default(false),

  allowPostShiftOT: booleanLike.transform((value) => toBoolean(value, true)).default(true),

  capByRequestedMinutes: booleanLike.transform((value) => toBoolean(value, true)).default(true),

  treatForgetScanInAsPending: booleanLike
    .transform((value) => toBoolean(value, true))
    .default(true),

  treatForgetScanOutAsPending: booleanLike
    .transform((value) => toBoolean(value, true))
    .default(true),

  isActive: booleanLike.transform((value) => toBoolean(value, true)).default(true),
})

const updateOTCalculationPolicySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'ot.policy.validation.codeRequired')
      .max(50, 'ot.policy.validation.codeTooLong')
      .transform((value) => upper(value))
      .optional(),

    name: z
      .string()
      .trim()
      .min(1, 'ot.policy.validation.nameRequired')
      .max(150, 'ot.policy.validation.nameTooLong')
      .optional(),

    description: z
      .string()
      .trim()
      .max(1000, 'ot.policy.validation.descriptionTooLong')
      .optional(),

    minEligibleMinutes: z.coerce
      .number()
      .int('ot.policy.validation.minEligibleMinutesInvalid')
      .min(0, 'ot.policy.validation.minEligibleMinutesInvalid')
      .optional(),

    roundUnitMinutes: z.coerce
      .number()
      .int('ot.policy.validation.roundUnitMinutesInvalid')
      .min(1, 'ot.policy.validation.roundUnitMinutesInvalid')
      .optional(),

    roundMethod: optionalRoundMethodField,

    graceAfterShiftEndMinutes: z.coerce
      .number()
      .int('ot.policy.validation.graceAfterShiftEndMinutesInvalid')
      .min(0, 'ot.policy.validation.graceAfterShiftEndMinutesInvalid')
      .optional(),

    allowApprovedOtWithoutExactClockOut: booleanLike
      .transform((value) => toBoolean(value))
      .optional(),

    allowPreShiftOT: booleanLike.transform((value) => toBoolean(value)).optional(),

    allowPostShiftOT: booleanLike.transform((value) => toBoolean(value)).optional(),

    capByRequestedMinutes: booleanLike.transform((value) => toBoolean(value)).optional(),

    treatForgetScanInAsPending: booleanLike.transform((value) => toBoolean(value)).optional(),

    treatForgetScanOutAsPending: booleanLike.transform((value) => toBoolean(value)).optional(),

    isActive: booleanLike.transform((value) => toBoolean(value)).optional(),
  })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.minEligibleMinutes !== undefined ||
      value.roundUnitMinutes !== undefined ||
      value.roundMethod !== undefined ||
      value.graceAfterShiftEndMinutes !== undefined ||
      value.allowApprovedOtWithoutExactClockOut !== undefined ||
      value.allowPreShiftOT !== undefined ||
      value.allowPostShiftOT !== undefined ||
      value.capByRequestedMinutes !== undefined ||
      value.treatForgetScanInAsPending !== undefined ||
      value.treatForgetScanOutAsPending !== undefined ||
      value.isActive !== undefined,
    {
      message: 'ot.policy.validation.updatePayloadRequired',
    },
  )

const listOTCalculationPoliciesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  search: z.string().trim().optional().default(''),

  isActive: booleanLike.transform((value) => toBoolean(value)).optional(),

  roundMethod: optionalRoundMethodField,

  sortField: z
    .enum([
      'createdAt',
      'updatedAt',
      'code',
      'name',
      'roundMethod',
      'roundUnitMinutes',
      'minEligibleMinutes',
      'graceAfterShiftEndMinutes',
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
      'roundMethod',
      'roundUnitMinutes',
      'minEligibleMinutes',
      'graceAfterShiftEndMinutes',
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

const lookupOTCalculationPoliciesQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  isActive: booleanLike.transform((value) => toBoolean(value, true)).optional(),

  roundMethod: optionalRoundMethodField,

  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const otCalculationPolicyIdParamSchema = z.object({
  id: objectIdSchema,
})

function normalizeListQuery(raw = {}) {
  const parsed = listOTCalculationPoliciesQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    isActive: parsed.isActive,
    roundMethod: parsed.roundMethod,
    sortField: parsed.sortBy || parsed.sortField || 'createdAt',
    sortOrder: parsed.sortOrder,
  }
}

function normalizeLookupQuery(raw = {}) {
  const parsed = lookupOTCalculationPoliciesQuerySchema.parse(raw)

  return {
    search: parsed.search,
    isActive: parsed.isActive,
    roundMethod: parsed.roundMethod,
    limit: parsed.limit,
  }
}

module.exports = {
  ROUND_METHODS,
  objectIdSchema,
  createOTCalculationPolicySchema,
  updateOTCalculationPolicySchema,
  normalizeListQuery,
  normalizeLookupQuery,
  otCalculationPolicyIdParamSchema,
}