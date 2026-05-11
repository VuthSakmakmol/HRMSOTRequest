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

const paymentExportBodySchema = z
  .object({
    fromDate: ymdSchema,
    toDate: ymdSchema,
    formulaId: objectIdSchema,
  })
  .superRefine((data, ctx) => {
    if (data.fromDate && data.toDate && data.fromDate > data.toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toDate'],
        message: 'To date must be greater than or equal to from date',
      })
    }
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