// backend/src/modules/payment/validations/paymentFormula.validation.js

const { z } = require('zod')

const toNumber = (fieldName, min = 0) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined
      return Number(value)
    },
    z
      .number({
        required_error: `${fieldName} is required`,
        invalid_type_error: `${fieldName} must be a number`,
      })
      .min(min, `${fieldName} must be at least ${min}`)
  )

const toOptionalNumber = (fieldName, min = 0) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return undefined
      return Number(value)
    },
    z.number({ invalid_type_error: `${fieldName} must be a number` }).min(min).optional()
  )

const booleanQuery = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  return value
}, z.boolean().optional())

const listPaymentFormulaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  isActive: booleanQuery,
  sortBy: z
    .enum(['code', 'name', 'createdAt', 'updatedAt', 'monthlyWorkingDays', 'hoursPerDay'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

const lookupPaymentFormulaQuerySchema = z.object({
  search: z.string().trim().optional().default(''),
  isActive: booleanQuery.default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const multiplierSchema = z.object({
  WORKING_DAY: toNumber('Working day multiplier', 0),
  SUNDAY: toNumber('Sunday multiplier', 0),
  HOLIDAY: toNumber('Holiday multiplier', 0),
})

const createPaymentFormulaSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().optional().default(''),

  salaryBasis: z.enum(['MONTHLY_SALARY']).optional().default('MONTHLY_SALARY'),

  monthlyWorkingDays: toNumber('Monthly working days', 1),
  hoursPerDay: toNumber('Hours per day', 1),

  multipliers: multiplierSchema,

  roundingDecimals: z.coerce.number().int().min(0).max(6).optional().default(2),
  currency: z.string().trim().min(1).max(10).optional().default('USD'),
  isActive: z.boolean().optional().default(true),
})

const updatePaymentFormulaSchema = z.object({
  code: z.string().trim().min(1).max(50).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().optional(),

  salaryBasis: z.enum(['MONTHLY_SALARY']).optional(),

  monthlyWorkingDays: toOptionalNumber('Monthly working days', 1),
  hoursPerDay: toOptionalNumber('Hours per day', 1),

  multipliers: multiplierSchema.partial().optional(),

  roundingDecimals: z.coerce.number().int().min(0).max(6).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
})

module.exports = {
  listPaymentFormulaQuerySchema,
  lookupPaymentFormulaQuerySchema,
  createPaymentFormulaSchema,
  updatePaymentFormulaSchema,
}