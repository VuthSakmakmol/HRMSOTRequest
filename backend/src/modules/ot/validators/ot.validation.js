// backend/src/modules/ot/validators/ot.validation.js
const mongoose = require('mongoose')
const { z } = require('zod')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function emptyToUndefined(value) {
  const text = s(value)
  return text ? text : undefined
}

function optionalTrimmedString(max = 2000) {
  return z
    .preprocess(
      (value) => s(value),
      z.string().max(max, `Must be at most ${max} characters`),
    )
    .optional()
    .default('')
}

function requiredUpperEnum(values, label) {
  return z.preprocess(
    (value) => upper(value),
    z.enum(values, {
      required_error: `${label} is required`,
      invalid_type_error: `${label} is invalid`,
    }),
  )
}

function optionalUpperEnum(values, label) {
  return z
    .preprocess(
      (value) => {
        const text = upper(value)
        return text || undefined
      },
      z.enum(values, {
        invalid_type_error: `${label} is invalid`,
      }),
    )
    .optional()
}

const objectIdSchema = z.preprocess(
  (value) => s(value),
  z
    .string()
    .min(1, 'ID is required')
    .refine((value) => mongoose.isValidObjectId(value), {
      message: 'Invalid ID',
    }),
)

function optionalObjectIdSchema(label = 'ID') {
  return z
    .preprocess(
      (value) => emptyToUndefined(value),
      z
        .string()
        .refine((value) => mongoose.isValidObjectId(value), {
          message: `Invalid ${label}`,
        }),
    )
    .optional()
}

const ymdSchema = z.preprocess(
  (value) => s(value),
  z
    .string({
      required_error: 'Date is required',
      invalid_type_error: 'Date is required',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
)

const optionalYmdSchema = z
  .preprocess(
    (value) => emptyToUndefined(value),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  )
  .optional()

const hhmmSchema = z
  .preprocess(
    (value) => emptyToUndefined(value),
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:mm'),
  )
  .optional()

const requiredHhmmSchema = z.preprocess(
  (value) => s(value),
  z
    .string({
      required_error: 'Time is required',
      invalid_type_error: 'Time is required',
    })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:mm'),
)

const breakMinutesSchema = z
  .preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') return 0
      return Number(value)
    },
    z.number().int().min(0).max(1440),
  )
  .optional()
  .default(0)

const employeeTimeOverrideSchema = z.object({
  employeeId: objectIdSchema,
  startTime: requiredHhmmSchema,
  endTime: requiredHhmmSchema,
  breakMinutes: breakMinutesSchema,
})

const positivePageSchema = z.preprocess(
  (value) => Number(value || 1),
  z.number().int().min(1).default(1),
)

const limitSchema = z.preprocess(
  (value) => Number(value || 10),
  z.number().int().min(1).max(100).default(10),
)

const sortOrderSchema = z
  .preprocess(
    (value) => {
      const text = s(value).toLowerCase()
      return text || 'desc'
    },
    z.enum(['asc', 'desc']),
  )
  .default('desc')

const OT_STATUS = [
  'PENDING',
  'PENDING_REQUESTER_CONFIRMATION',
  'APPROVED',
  'REJECTED',
  'REQUESTER_DISAGREED',
  'CANCELLED',
]

const OT_DAY_TYPE = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

const OT_SORT_FIELDS = [
  'createdAt',
  'otDate',
  'requestNo',
  'requesterName',
  'status',
  'totalHours',
  'employeeCount',
]

const otRequestWriteSchema = z
  .object({
    employeeIds: z
      .array(objectIdSchema, {
        required_error: 'Please select at least 1 employee',
        invalid_type_error: 'employeeIds must be an array',
      })
      .min(1, 'Please select at least 1 employee')
      .max(200, 'You can select up to 200 employees only'),

    otDate: ymdSchema,

    /**
     * SHIFT_OPTION:
     * - User chooses admin-created Shift OT Option.
     *
     * CUSTOM_FIXED:
     * - User still chooses Shift OT Option for policy/template.
     * - User manually inputs default OT start/end time.
     */
    otTimingSource: requiredUpperEnum(
      ['SHIFT_OPTION', 'CUSTOM_FIXED'],
      'OT timing source',
    ).default('SHIFT_OPTION'),

    /**
     * Still required for both modes because backend uses this option
     * to resolve shift, timing template, and calculation policy.
     */
    shiftOtOptionId: objectIdSchema,

    /**
     * Used only when otTimingSource = CUSTOM_FIXED.
     */
    customStartTime: hhmmSchema,
    customEndTime: hhmmSchema,
    customBreakMinutes: breakMinutesSchema,

    /**
     * Optional employee-level time overrides.
     * Employees not listed here will use the default request time.
     */
    employeeTimeOverrides: z
      .array(employeeTimeOverrideSchema)
      .max(200, 'Employee time overrides can contain up to 200 employees only')
      .optional()
      .default([]),

    reason: optionalTrimmedString(2000),

    /**
     * Legacy/manual fields kept optional so old payloads will not break validation.
     */
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    breakMinutes: breakMinutesSchema,
  })
  .superRefine((value, ctx) => {
    if (value.otTimingSource === 'CUSTOM_FIXED') {
      if (!value.customStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customStartTime'],
          message: 'Custom start time is required',
        })
      }

      if (!value.customEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customEndTime'],
          message: 'Custom end time is required',
        })
      }

      if (
        value.customStartTime &&
        value.customEndTime &&
        value.customStartTime === value.customEndTime
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customEndTime'],
          message: 'Custom start time and end time cannot be the same',
        })
      }
    }

    const employeeIdSet = new Set(value.employeeIds.map((id) => String(id)))
    const overrideEmployeeIdSet = new Set()

    for (const [index, item] of value.employeeTimeOverrides.entries()) {
      const employeeId = String(item.employeeId)

      if (!employeeIdSet.has(employeeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['employeeTimeOverrides', index, 'employeeId'],
          message: 'Override employee must be included in selected employees',
        })
      }

      if (overrideEmployeeIdSet.has(employeeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['employeeTimeOverrides', index, 'employeeId'],
          message: 'Duplicate employee override is not allowed',
        })
      }

      overrideEmployeeIdSet.add(employeeId)

      if (item.startTime === item.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['employeeTimeOverrides', index, 'endTime'],
          message: 'Override start time and end time cannot be the same',
        })
      }
    }
  })

const createOTRequestSchema = otRequestWriteSchema

const updateOTRequestSchema = otRequestWriteSchema

const listOTRequestsQuerySchema = z.object({
  page: positivePageSchema,
  limit: limitSchema,

  search: z
    .preprocess((value) => s(value), z.string().max(200))
    .optional()
    .default(''),

  status: optionalUpperEnum(OT_STATUS, 'Status'),
  dayType: optionalUpperEnum(OT_DAY_TYPE, 'Day type'),

  employeeId: optionalObjectIdSchema('employeeId'),
  departmentId: optionalObjectIdSchema('departmentId'),
  positionId: optionalObjectIdSchema('positionId'),

  otDateFrom: optionalYmdSchema,
  otDateTo: optionalYmdSchema,

  sortBy: z
    .preprocess(
      (value) => {
        const text = s(value)
        return text || 'createdAt'
      },
      z.enum(OT_SORT_FIELDS),
    )
    .optional()
    .default('createdAt'),

  sortOrder: sortOrderSchema,
})

const listOTApprovalInboxQuerySchema = z.object({
  page: positivePageSchema,
  limit: limitSchema,

  search: z
    .preprocess((value) => s(value), z.string().max(200))
    .optional()
    .default(''),

  status: optionalUpperEnum(OT_STATUS, 'Status'),
  dayType: optionalUpperEnum(OT_DAY_TYPE, 'Day type'),

  otDateFrom: optionalYmdSchema,
  otDateTo: optionalYmdSchema,

  sortBy: z
    .preprocess(
      (value) => {
        const text = s(value)
        return text || 'createdAt'
      },
      z.enum(OT_SORT_FIELDS),
    )
    .optional()
    .default('createdAt'),

  sortOrder: sortOrderSchema,
})

const unavailableOTEmployeesQuerySchema = z.object({
  otDate: ymdSchema,
})

const otRequestIdParamSchema = z.object({
  id: objectIdSchema,
})

const otApprovalDecisionSchema = z.object({
  action: requiredUpperEnum(['APPROVE', 'REJECT'], 'Action'),
  remark: optionalTrimmedString(1000),
})

module.exports = {
  createOTRequestSchema,
  updateOTRequestSchema,
  listOTRequestsQuerySchema,
  listOTApprovalInboxQuerySchema,
  unavailableOTEmployeesQuerySchema,
  otRequestIdParamSchema,
  otApprovalDecisionSchema,
}