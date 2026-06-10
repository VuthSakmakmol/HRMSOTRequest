// backend/src/modules/payment/validations/paymentFormula.validation.js

const { z } = require('zod')

const SALARY_BASIS = ['MONTHLY_SALARY']
const DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']
const CASH_ROUNDING_MODES = ['CEIL', 'FLOOR', 'ROUND', 'NONE']
const DEFAULT_CASH_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

const FORMULA_SORT_FIELDS = [
  'code',
  'name',
  'createdAt',
  'updatedAt',
  'monthlyWorkingDays',
  'hoursPerDay',
  'roundingDecimals',
  'currency',
  'payoutCurrency',
  'cashRoundingUnit',
  'cashRoundingMode',
  'isActive',
]

function s(value) {
  return String(value ?? '').trim()
}

function optionalTrimmedString(max = 500) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw || undefined
    },
    z.string().max(max).optional(),
  )
}

function requiredTrimmedString(label, max = 500) {
  return z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be text`,
    })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} is too long`)
}

function optionalUpperString(max = 100) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.string().max(max).optional(),
  )
}

function requiredUpperString(label, max = 100) {
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

function optionalUpperEnum(values) {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.enum(values).optional(),
  )
}

function numberField(label, min = 0) {
  return z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined
      return Number(value)
    },
    z
      .number({
        required_error: `${label} is required`,
        invalid_type_error: `${label} must be a number`,
      })
      .min(min, `${label} must be at least ${min}`),
  )
}

function optionalNumberField(label, min = 0) {
  return z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined
      return Number(value)
    },
    z
      .number({
        invalid_type_error: `${label} must be a number`,
      })
      .min(min, `${label} must be at least ${min}`)
      .optional(),
  )
}

function optionalBoolean() {
  return z.preprocess(
    (value) => {
      const raw = s(value).toLowerCase()

      if (!raw) return undefined
      if (value === true || raw === 'true' || raw === '1' || raw === 'yes') return true
      if (value === false || raw === 'false' || raw === '0' || raw === 'no') return false

      return value
    },
    z.boolean().optional(),
  )
}

function roundingModeField() {
  return z.preprocess(
    (value) => s(value).toUpperCase(),
    z.enum(CASH_ROUNDING_MODES),
  )
}

function optionalRoundingModeField() {
  return z.preprocess(
    (value) => {
      const raw = s(value)
      return raw ? raw.toUpperCase() : undefined
    },
    z.enum(CASH_ROUNDING_MODES).optional(),
  )
}

const denominationsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return value
}, z.array(z.coerce.number().int().positive()).min(1, 'At least one cash denomination is required'))

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

const pageSchema = z.coerce.number().int().min(1).default(1)
const limitSchema = z.coerce.number().int().min(1).max(200).default(10)
const sortOrderSchema = z.enum(['asc', 'desc']).default('desc')

const multiplierSchema = z.object({
  WORKING_DAY: numberField('Working day multiplier', 0),
  SUNDAY: numberField('Sunday multiplier', 0),
  HOLIDAY: numberField('Holiday multiplier', 0),
})

const hourRuleSchema = z
  .object({
    label: optionalTrimmedString(120).default(''),
    minHours: numberField('Minimum OT hours', 0),
    maxHours: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return null
        return Number(value)
      },
      z.number().min(0, 'Maximum OT hours must be at least 0').nullable().optional(),
    ),
    multiplier: numberField('Hour rule multiplier', 0),
    allowanceEligible: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.maxHours !== null && data.maxHours !== undefined && data.maxHours <= data.minHours) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxHours'],
        message: 'Maximum OT hours must be greater than minimum OT hours',
      })
    }
  })

const hourRulesSchema = z.array(hourRuleSchema).min(1, 'At least one hour rule is required')

const createPaymentFormulaSchema = z.object({
  code: requiredUpperString('Code', 50),
  name: requiredTrimmedString('Name', 150),
  description: optionalTrimmedString(1000).default(''),

  salaryBasis: optionalUpperEnum(SALARY_BASIS).default('MONTHLY_SALARY'),

  monthlyWorkingDays: numberField('Monthly working days', 1).default(26),
  hoursPerDay: numberField('Hours per day', 1).default(8),

  multipliers: multiplierSchema.default({
    WORKING_DAY: 1.5,
    SUNDAY: 2,
    HOLIDAY: 3,
  }),

  hourRules: hourRulesSchema,

  roundingDecimals: z.coerce.number().int().min(0).max(6).default(2),
  currency: optionalUpperString(10).default('USD'),

  payoutCurrency: optionalUpperString(10).default('KHR'),
  cashRoundingUnit: z.coerce.number().int().positive().default(100),
  cashRoundingMode: roundingModeField().default('ROUND'),
  cashDenominations: denominationsSchema.default(DEFAULT_CASH_DENOMINATIONS),

  isActive: z.boolean().optional().default(true),
})

const updatePaymentFormulaSchema = z
  .object({
    code: optionalUpperString(50),
    name: optionalTrimmedString(150),
    description: optionalTrimmedString(1000),

    salaryBasis: optionalUpperEnum(SALARY_BASIS),

    monthlyWorkingDays: optionalNumberField('Monthly working days', 1),
    hoursPerDay: optionalNumberField('Hours per day', 1),

    multipliers: multiplierSchema.partial().optional(),
    hourRules: hourRulesSchema.optional(),

    roundingDecimals: z.coerce.number().int().min(0).max(6).optional(),
    currency: optionalUpperString(10),

    payoutCurrency: optionalUpperString(10),
    cashRoundingUnit: z.coerce.number().int().positive().optional(),
    cashRoundingMode: optionalRoundingModeField(),
    cashDenominations: denominationsSchema.optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })

const listPaymentFormulaQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: optionalTrimmedString(200).default(''),
  isActive: optionalBoolean(),

  sortBy: z.preprocess(
    (value) => {
      const raw = s(value)
      return raw || undefined
    },
    z.enum(FORMULA_SORT_FIELDS).optional().default('createdAt'),
  ),

  sortOrder: sortOrderSchema,
})

const lookupPaymentFormulaQuerySchema = z.object({
  search: optionalTrimmedString(200).default(''),
  isActive: optionalBoolean().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const paymentFormulaIdParamSchema = z.object({
  id: objectIdSchema,
})

module.exports = {
  listPaymentFormulaQuerySchema,
  lookupPaymentFormulaQuerySchema,
  createPaymentFormulaSchema,
  updatePaymentFormulaSchema,
  paymentFormulaIdParamSchema,

  SALARY_BASIS,
  DAY_TYPES,
  CASH_ROUNDING_MODES,
  DEFAULT_CASH_DENOMINATIONS,
  FORMULA_SORT_FIELDS,
}