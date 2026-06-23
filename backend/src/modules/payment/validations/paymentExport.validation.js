// backend/src/modules/payment/validations/paymentExport.validation.js

const { z } = require('zod')

function s(value) {
  return String(value ?? '').trim()
}

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id')

const ymdSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

const selectedDatesSchema = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') return undefined
    if (Array.isArray(value)) return value

    try {
      return JSON.parse(s(value))
    } catch (error) {
      return value
    }
  },
  z.array(ymdSchema).min(1, 'Select at least one payment date').optional(),
)

const manualExchangeRateSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined
    return Number(value)
  },
  z
    .number({
      required_error: 'Manual exchange rate is required',
      invalid_type_error: 'Manual exchange rate must be a number',
    })
    .positive('Manual exchange rate must be greater than 0'),
)

const paymentExportBodySchema = z
  .object({
    fromDate: ymdSchema,
    toDate: ymdSchema,
    selectedDates: selectedDatesSchema,
    formulaId: objectIdSchema,
    exchangeRate: manualExchangeRateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate && data.toDate && data.fromDate > data.toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'To date must be greater than or equal to from date',
      })
    }

    const selectedDates = Array.isArray(data.selectedDates) ? data.selectedDates : []
    const seenDates = new Set()

    selectedDates.forEach((date, index) => {
      if (seenDates.has(date)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['selectedDates', index],
          message: 'Payment dates must not contain duplicates',
        })
      }

      seenDates.add(date)

      if (data.fromDate && data.toDate && (date < data.fromDate || date > data.toDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['selectedDates', index],
          message: 'Each payment date must be inside the selected period',
        })
      }
    })
  })

const paymentPreviewBodySchema = paymentExportBodySchema

const paymentFormulaIdParamSchema = z.object({
  id: objectIdSchema,
})

function parseBody(schema, data) {
  const result = schema.safeParse(data || {})

  if (!result.success) {
    const error = new Error(result.error.issues?.[0]?.message || 'Invalid request')
    error.status = 400
    error.statusCode = 400
    throw error
  }

  return result.data
}

function parseOptionalSearch(value, max = 200) {
  const raw = s(value)
  return raw.length > max ? raw.slice(0, max) : raw
}

module.exports = {
  paymentExportBodySchema,
  paymentPreviewBodySchema,
  paymentFormulaIdParamSchema,

  parseBody,
  parseOptionalSearch,
}