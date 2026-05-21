// backend/src/modules/allowance/validators/paymentAllowancePolicy.validation.js

const { z } = require('zod')

const ALLOWANCE_TYPES = ['FOOD', 'TRANSPORT', 'NIGHT', 'HOLIDAY', 'OTHER']
const TRIGGER_TYPES = ['OT_MINUTES']
const CURRENCIES = ['KHR', 'USD']
const APPLY_PER_OPTIONS = ['EMPLOYEE_PER_DAY', 'EMPLOYEE_PER_REQUEST']

const objectIdSchema = z
  .string()
  .trim()
  .min(1, 'Allowance policy ID is required.')
  .regex(/^[a-f\d]{24}$/i, 'Invalid allowance policy ID.')

const booleanQuerySchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined
    if (typeof value === 'boolean') return value

    const normalized = String(value).trim().toLowerCase()

    if (normalized === 'true') return true
    if (normalized === 'false') return false

    return undefined
  })

const pageSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    const number = Number(value || 1)
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1
  })

const limitSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    const number = Number(value || 10)
    if (!Number.isFinite(number)) return 10
    return Math.min(Math.max(Math.floor(number), 1), 200)
  })

const allowanceTypeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .default('FOOD')
  .refine((value) => ALLOWANCE_TYPES.includes(value), {
    message: 'Allowance type is invalid.',
  })

const triggerTypeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .default('OT_MINUTES')
  .refine((value) => TRIGGER_TYPES.includes(value), {
    message: 'Trigger type is invalid.',
  })

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .default('KHR')
  .refine((value) => CURRENCIES.includes(value), {
    message: 'Currency is invalid.',
  })

const applyPerSchema = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .default('EMPLOYEE_PER_DAY')
  .refine((value) => APPLY_PER_OPTIONS.includes(value), {
    message: 'Apply per is invalid.',
  })

const paymentAllowancePolicyBaseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code is required.')
    .max(50, 'Code must not be longer than 50 characters.'),

  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(150, 'Name must not be longer than 150 characters.'),

  description: z
    .string()
    .trim()
    .max(1000, 'Description must not be longer than 1000 characters.')
    .optional()
    .default(''),

  allowanceType: allowanceTypeSchema,
  triggerType: triggerTypeSchema,

  minOtMinutes: z
    .number({ invalid_type_error: 'Minimum OT minutes must be a number.' })
    .int('Minimum OT minutes must be a whole number.')
    .min(1, 'Minimum OT minutes must be at least 1.'),

  amount: z
    .number({ invalid_type_error: 'Amount must be a number.' })
    .min(0, 'Amount cannot be negative.'),

  currency: currencySchema,
  applyPer: applyPerSchema,

  isActive: z.boolean().optional().default(true),
})

const createPaymentAllowancePolicySchema = paymentAllowancePolicyBaseSchema

const updatePaymentAllowancePolicySchema = paymentAllowancePolicyBaseSchema
  .partial()
  .refine((data) => Object.keys(data || {}).length > 0, {
    message: 'At least one field is required.',
  })

const paymentAllowancePolicyIdParamSchema = z.object({
  id: objectIdSchema,
})

const listPaymentAllowancePolicyQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: z
    .string()
    .trim()
    .max(100, 'Search text must not be longer than 100 characters.')
    .optional()
    .default(''),

  isActive: booleanQuerySchema,

  allowanceType: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => value || undefined),

  triggerType: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => value || undefined),

  sortField: z
    .enum([
      'code',
      'name',
      'allowanceType',
      'triggerType',
      'minOtMinutes',
      'amount',
      'currency',
      'applyPer',
      'isActive',
      'createdAt',
      'updatedAt',
    ])
    .optional()
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

const lookupPaymentAllowancePolicyQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(100, 'Search text must not be longer than 100 characters.')
    .optional()
    .default(''),

  isActive: booleanQuerySchema,

  limit: limitSchema,
})

module.exports = {
  createPaymentAllowancePolicySchema,
  updatePaymentAllowancePolicySchema,
  paymentAllowancePolicyIdParamSchema,
  listPaymentAllowancePolicyQuerySchema,
  lookupPaymentAllowancePolicyQuerySchema,
}