// backend/src/modules/ot/validators/otPolicy.validation.js
const { z } = require('zod')

const ROUND_METHODS = ['FLOOR', 'CEIL', 'NEAREST']

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

function normalizeSortOrder(value) {
  if (value === 1 || value === '1' || value === 'asc') return 1
  return -1
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')

const roundMethodSchema = z.preprocess(
  (value) => s(value || 'CEIL').toUpperCase(),
  z.enum(ROUND_METHODS),
)

const optionalRoundMethodSchema = z.preprocess(
  (value) => {
    const text = s(value)
    if (!text) return undefined
    return text.toUpperCase()
  },
  z.enum(ROUND_METHODS).optional(),
)

const createOTCalculationPolicySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(50, 'Code must not exceed 50 characters')
    .transform((value) => value.toUpperCase()),

  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(150, 'Name must not exceed 150 characters'),

  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional()
    .default(''),

  minEligibleMinutes: z.coerce
    .number()
    .int('Min eligible minutes must be an integer')
    .min(0, 'Min eligible minutes must be at least 0')
    .default(0),

  roundUnitMinutes: z.coerce
    .number()
    .int('Round unit minutes must be an integer')
    .min(1, 'Round unit minutes must be at least 1')
    .default(30),

  roundMethod: roundMethodSchema.default('CEIL'),

  graceAfterShiftEndMinutes: z.coerce
    .number()
    .int('Grace after shift end minutes must be an integer')
    .min(0, 'Grace after shift end minutes must be at least 0')
    .default(0),

  // ✅ SPECIAL COMPANY RULE
  allowApprovedOtWithoutExactClockOut: z
    .preprocess(toBool, z.boolean().optional())
    .default(false),

  allowPreShiftOT: z.preprocess(toBool, z.boolean().optional()).default(false),
  allowPostShiftOT: z.preprocess(toBool, z.boolean().optional()).default(true),
  capByRequestedMinutes: z.preprocess(toBool, z.boolean().optional()).default(true),
  treatForgetScanInAsPending: z.preprocess(toBool, z.boolean().optional()).default(true),
  treatForgetScanOutAsPending: z.preprocess(toBool, z.boolean().optional()).default(true),
  isActive: z.preprocess(toBool, z.boolean().optional()).default(true),
})

const updateOTCalculationPolicySchema = createOTCalculationPolicySchema
  .partial()
  .refine((value) => Object.keys(value || {}).length > 0, {
    message: 'At least one field is required',
  })

const listOTCalculationPoliciesQuerySchema = z
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

    isActive: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined
        return toBool(value)
      },
      z.boolean().optional(),
    ),

    roundMethod: optionalRoundMethodSchema,

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
      .optional(),

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

    sortOrder: z.preprocess(
      normalizeSortOrder,
      z.union([z.literal(1), z.literal(-1)]).default(-1),
    ),
  })
  .transform((value) => ({
    ...value,
    sortField: value.sortField || value.sortBy || 'createdAt',
  }))

const lookupOTCalculationPoliciesQuerySchema = z.object({
  search: z.string().trim().optional().default(''),

  limit: z.preprocess(
    (value) => toInt(value, 20),
    z.number().int().min(1).max(50).default(20),
  ),

  isActive: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return true
      return toBool(value)
    },
    z.boolean().optional().default(true),
  ),

  roundMethod: optionalRoundMethodSchema,
})

const otCalculationPolicyIdParamSchema = z.object({
  id: objectIdSchema,
})

module.exports = {
  objectIdSchema,
  createOTCalculationPolicySchema,
  updateOTCalculationPolicySchema,
  listOTCalculationPoliciesQuerySchema,
  lookupOTCalculationPoliciesQuerySchema,
  otCalculationPolicyIdParamSchema,
}