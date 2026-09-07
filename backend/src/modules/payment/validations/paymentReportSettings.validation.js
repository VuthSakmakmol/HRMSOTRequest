const { z } = require('zod')

const positionIdSchema = z.string().trim().min(1, 'Position is required')

const createPaymentReportSettingSchema = z.object({
  positionId: positionIdSchema,
})

const updatePaymentReportSettingSchema = z.object({
  positionId: positionIdSchema,
})

function parse(schema, data) {
  const result = schema.safeParse(data || {})

  if (result.success) return result.data

  const error = new Error(result.error.issues?.[0]?.message || 'Invalid request')
  error.statusCode = 400
  error.status = 400
  error.issues = result.error.issues
  throw error
}

module.exports = {
  createPaymentReportSettingSchema,
  updatePaymentReportSettingSchema,
  parse,
}
