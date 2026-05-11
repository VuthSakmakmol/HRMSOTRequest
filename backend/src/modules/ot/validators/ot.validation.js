// backend/src/modules/ot/validators/ot.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

const OT_STATUS = [
  'PENDING',
  'PENDING_REQUESTER_CONFIRMATION',
  'APPROVED',
  'REJECTED',
  'REQUESTER_DISAGREED',
  'CANCELLED',
]

const OT_DAY_TYPES = ['WORKING_DAY', 'SUNDAY', 'HOLIDAY']

const OT_TIMING_SOURCES = ['SHIFT_OPTION', 'CUSTOM_FIXED']

const OT_APPROVAL_ACTIONS = ['APPROVE', 'REJECT']

const OT_REQUESTER_CONFIRMATION_ACTIONS = ['AGREE', 'DISAGREE']

const OT_SORT_FIELDS = [
  'createdAt',
  'otDate',
  'requestNo',
  'requesterName',
  'status',
  'totalHours',
  'employeeCount',
]

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function toBoolean(value, defaultValue = undefined) {
  if (value === undefined || value === null || value === '') return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const text = String(value).trim().toLowerCase()

  if (['true', '1', 'yes', 'y', 'active'].includes(text)) return true
  if (['false', '0', 'no', 'n', 'inactive'].includes(text)) return false

  return defaultValue
}

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

const objectIdSchema = z
  .string()
  .trim()
  .min(1, 'common.validation.idRequired')
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const optionalObjectIdSchema = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || isObjectId(value), 'common.validation.invalidId')

const ymdSchema = z
  .string()
  .trim()
  .min(1, 'ot.request.validation.otDateRequired')
  .regex(YMD_REGEX, 'common.validation.dateInvalid')

const optionalYmdSchema = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || YMD_REGEX.test(value), 'common.validation.dateInvalid')

const hhmmSchema = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine((value) => !value || HHMM_REGEX.test(value), 'common.validation.timeInvalid')

const requiredHhmmSchema = z
  .string()
  .trim()
  .min(1, 'common.validation.timeRequired')
  .regex(HHMM_REGEX, 'common.validation.timeInvalid')

const breakMinutesSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null || value === '') return 0
    return Number(value)
  })
  .refine(
    (value) => Number.isInteger(value) && value >= 0 && value <= 1440,
    'ot.request.validation.breakMinutesInvalid',
  )

const optionalTextSchema = (max, messageKey) =>
  z
    .string()
    .trim()
    .max(max, messageKey)
    .optional()
    .default('')

const upperEnumSchema = (values, messageKey) =>
  z
    .string()
    .trim()
    .transform((value) => upper(value))
    .refine((value) => values.includes(value), messageKey)

const optionalUpperEnumSchema = (values, messageKey) =>
  z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((value) => upper(value))
    .refine((value) => !value || values.includes(value), messageKey)

const pageSchema = z.coerce
  .number()
  .int('common.validation.pageInvalid')
  .min(1, 'common.validation.pageInvalid')
  .default(1)

const limitSchema = z.coerce
  .number()
  .int('common.validation.limitInvalid')
  .min(1, 'common.validation.limitInvalid')
  .max(100, 'common.validation.limitInvalid')
  .default(10)

const sortOrderSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    const text = s(value).toLowerCase()

    if (value === 1 || text === '1' || text === 'asc') return 'asc'
    if (value === -1 || text === '-1' || text === 'desc') return 'desc'

    return 'desc'
  })

const employeeTimeOverrideSchema = z
  .object({
    employeeId: objectIdSchema,

    startTime: requiredHhmmSchema,

    endTime: requiredHhmmSchema,

    breakMinutes: breakMinutesSchema.default(0),
  })
  .superRefine((value, ctx) => {
    if (value.startTime === value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'ot.request.validation.overrideTimeSame',
      })
    }
  })

const otRequestWriteSchema = z
  .object({
    employeeIds: z
      .array(objectIdSchema, {
        required_error: 'ot.request.validation.employeeRequired',
        invalid_type_error: 'ot.request.validation.employeeIdsInvalid',
      })
      .min(1, 'ot.request.validation.employeeRequired')
      .max(200, 'ot.request.validation.employeeMaxExceeded')
      .transform((values) => [...new Set(values.map(s).filter(Boolean))]),

    otDate: ymdSchema,

    otTimingSource: z
      .string()
      .trim()
      .optional()
      .default('SHIFT_OPTION')
      .transform((value) => upper(value || 'SHIFT_OPTION'))
      .refine(
        (value) => OT_TIMING_SOURCES.includes(value),
        'ot.request.validation.timingSourceInvalid',
      ),

    shiftOtOptionId: objectIdSchema,

    customStartTime: hhmmSchema,
    customEndTime: hhmmSchema,
    customBreakMinutes: breakMinutesSchema.default(0),

    employeeTimeOverrides: z
      .array(employeeTimeOverrideSchema)
      .max(200, 'ot.request.validation.employeeOverrideMaxExceeded')
      .optional()
      .default([]),

    reason: optionalTextSchema(2000, 'ot.request.validation.reasonTooLong'),
  })
  .superRefine((value, ctx) => {
    if (value.otTimingSource === 'CUSTOM_FIXED') {
      if (!value.customStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customStartTime'],
          message: 'ot.request.validation.customStartTimeRequired',
        })
      }

      if (!value.customEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customEndTime'],
          message: 'ot.request.validation.customEndTimeRequired',
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
          message: 'ot.request.validation.customTimeSame',
        })
      }
    }

    const employeeIdSet = new Set(value.employeeIds.map(s))
    const overrideEmployeeIdSet = new Set()

    value.employeeTimeOverrides.forEach((item, index) => {
      const employeeId = s(item.employeeId)

      if (!employeeIdSet.has(employeeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['employeeTimeOverrides', index, 'employeeId'],
          message: 'ot.request.validation.overrideEmployeeNotSelected',
        })
      }

      if (overrideEmployeeIdSet.has(employeeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['employeeTimeOverrides', index, 'employeeId'],
          message: 'ot.request.validation.overrideEmployeeDuplicate',
        })
      }

      overrideEmployeeIdSet.add(employeeId)
    })
  })

const createOTRequestSchema = otRequestWriteSchema

const updateOTRequestSchema = otRequestWriteSchema

const listOTRequestsQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: z
    .string()
    .trim()
    .max(200, 'common.validation.searchTooLong')
    .optional()
    .default(''),

  status: optionalUpperEnumSchema(OT_STATUS, 'ot.request.validation.statusInvalid'),

  dayType: optionalUpperEnumSchema(OT_DAY_TYPES, 'ot.request.validation.dayTypeInvalid'),

  employeeId: optionalObjectIdSchema,
  departmentId: optionalObjectIdSchema,
  positionId: optionalObjectIdSchema,
  lineId: optionalObjectIdSchema,

  otDateFrom: optionalYmdSchema,
  otDateTo: optionalYmdSchema,

  sortBy: z
    .string()
    .trim()
    .optional()
    .default('createdAt')
    .refine((value) => OT_SORT_FIELDS.includes(value), 'common.validation.sortFieldInvalid'),

  sortOrder: sortOrderSchema,
})

const listOTApprovalInboxQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,

  search: z
    .string()
    .trim()
    .max(200, 'common.validation.searchTooLong')
    .optional()
    .default(''),

  status: optionalUpperEnumSchema(OT_STATUS, 'ot.request.validation.statusInvalid'),

  dayType: optionalUpperEnumSchema(OT_DAY_TYPES, 'ot.request.validation.dayTypeInvalid'),

  employeeId: optionalObjectIdSchema,
  departmentId: optionalObjectIdSchema,
  positionId: optionalObjectIdSchema,
  lineId: optionalObjectIdSchema,

  otDateFrom: optionalYmdSchema,
  otDateTo: optionalYmdSchema,

  sortBy: z
    .string()
    .trim()
    .optional()
    .default('createdAt')
    .refine((value) => OT_SORT_FIELDS.includes(value), 'common.validation.sortFieldInvalid'),

  sortOrder: sortOrderSchema,
})

const unavailableOTEmployeesQuerySchema = z.object({
  otDate: ymdSchema,
})

const otRequestIdParamSchema = z.object({
  id: objectIdSchema,
})

const allowedApproverChainParamSchema = z.object({
  employeeId: objectIdSchema,
})

const shiftOptionsByShiftParamSchema = z.object({
  shiftId: objectIdSchema,
})

const shiftOptionsByShiftQuerySchema = z.object({
  otDate: optionalYmdSchema,

  dayType: optionalUpperEnumSchema(OT_DAY_TYPES, 'ot.request.validation.dayTypeInvalid'),
})

const otApprovalDecisionSchema = z
  .object({
    action: upperEnumSchema(
      OT_APPROVAL_ACTIONS,
      'ot.request.validation.approvalActionInvalid',
    ),

    remark: optionalTextSchema(1000, 'ot.request.validation.remarkTooLong'),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'REJECT' && !value.remark) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['remark'],
        message: 'ot.request.validation.rejectionReasonRequired',
      })
    }
  })

const otRequesterConfirmationSchema = z.object({
  action: upperEnumSchema(
    OT_REQUESTER_CONFIRMATION_ACTIONS,
    'ot.request.validation.requesterConfirmationActionInvalid',
  ),

  remark: optionalTextSchema(1000, 'ot.request.validation.remarkTooLong'),
})

module.exports = {
  OT_STATUS,
  OT_DAY_TYPES,
  OT_TIMING_SOURCES,
  OT_APPROVAL_ACTIONS,
  OT_REQUESTER_CONFIRMATION_ACTIONS,

  createOTRequestSchema,
  updateOTRequestSchema,
  listOTRequestsQuerySchema,
  listOTApprovalInboxQuerySchema,
  unavailableOTEmployeesQuerySchema,
  otRequestIdParamSchema,
  allowedApproverChainParamSchema,
  shiftOptionsByShiftParamSchema,
  shiftOptionsByShiftQuerySchema,
  otApprovalDecisionSchema,
  otRequesterConfirmationSchema,
}