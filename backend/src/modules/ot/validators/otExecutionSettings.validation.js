// backend/src/modules/ot/validators/otExecutionSettings.validation.js

const { z } = require('zod')

const time24HourSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid 24-hour time in HH:mm format')

const updateOTExecutionSettingsSchema = z
  .object({
    requestSubmissionOpen: z.boolean(),
    requestDailyTimeLimitEnabled: z.boolean(),
    requestDailyStartTime: time24HourSchema.nullable(),
    requestDailyEndTime: time24HourSchema.nullable(),
    allowBackdatedRequests: z.boolean(),
    paymentRequiresFinalApproval: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!data.requestDailyTimeLimitEnabled) return

    if (!data.requestDailyStartTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestDailyStartTime'],
        message: 'Daily start time is required when the daily time limit is enabled',
      })
    }

    if (!data.requestDailyEndTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestDailyEndTime'],
        message: 'Daily end time is required when the daily time limit is enabled',
      })
    }

    if (
      data.requestDailyStartTime &&
      data.requestDailyEndTime &&
      data.requestDailyStartTime === data.requestDailyEndTime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestDailyEndTime'],
        message: 'Daily start and end time cannot be the same. Disable the time limit to allow all hours.',
      })
    }
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
  updateOTExecutionSettingsSchema,
  parse,
}
