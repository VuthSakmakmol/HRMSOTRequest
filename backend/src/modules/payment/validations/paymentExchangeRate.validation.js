// backend/src/modules/payment/validations/paymentExchangeRate.validation.js

const { z } = require('zod')

const ROUNDING_MODES = ['CEIL', 'FLOOR', 'ROUND', 'NONE']

function s(value) {
  return String(value ?? '').trim()
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

const boolishSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') return value

  const text = s(value).toLowerCase()

  if (text === 'true') return true
  if (text === 'false') return false

  return value
}, z.boolean())

const sortOrderSchema = z.preprocess((value) => {
  if (value === 1 || value === '1') return 'asc'
  if (value === -1 || value === '-1') return 'desc'

  const text = s(value).toLowerCase()

  if (text === 'asc' || text === 'ascending') return 'asc'
  if (text === 'desc' || text === 'descending') return 'desc'

  return 'desc'
}, z.enum(['asc', 'desc']))

const roundingModeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.enum(ROUNDING_MODES))

const denominationsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return value
}, z.array(z.coerce.number().int().positive()).min(1, 'At least one denomination is required'))

const paymentExchangeRateIdParamSchema = z.object({
  id: objectIdSchema,
})

const listPaymentExchangeRateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional().default(''),
  isActive: boolishSchema.optional(),
  sortField: z.string().trim().optional().default('createdAt'),
  sortOrder: sortOrderSchema.default('desc'),
})

const lookupPaymentExchangeRateQuerySchema = z.object({
  search: z.string().trim().max(200).optional().default(''),
  isActive: boolishSchema.optional().default(true),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const createPaymentExchangeRateSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(1000).optional().default(''),

  fromCurrency: z.string().trim().min(1).max(10).optional().default('USD'),
  toCurrency: z.string().trim().min(1).max(10).optional().default('KHR'),

  rate: z.coerce.number().positive('Rate must be greater than 0'),
  roundingUnit: z.coerce.number().int().positive().optional().default(100),
  roundingMode: roundingModeSchema.optional().default('ROUND'),

  denominations: denominationsSchema
    .optional()
    .default([50000, 20000, 10000, 5000, 1000, 500, 100]),

  isActive: boolishSchema.optional().default(true),
})

const updatePaymentExchangeRateSchema = z
  .object({
    code: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(1000).optional(),

    fromCurrency: z.string().trim().min(1).max(10).optional(),
    toCurrency: z.string().trim().min(1).max(10).optional(),

    rate: z.coerce.number().positive('Rate must be greater than 0').optional(),
    roundingUnit: z.coerce.number().int().positive().optional(),
    roundingMode: roundingModeSchema.optional(),

    denominations: denominationsSchema.optional(),

    isActive: boolishSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No update data provided',
  })

module.exports = {
  paymentExchangeRateIdParamSchema,
  listPaymentExchangeRateQuerySchema,
  lookupPaymentExchangeRateQuerySchema,
  createPaymentExchangeRateSchema,
  updatePaymentExchangeRateSchema,
}