// backend/src/modules/ot/validators/ot.validation.js
const { z } = require('zod')

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id')

const otDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'otDate must be YYYY-MM-DD')

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:mm')

const optionalTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be HH:mm')
  .optional()
  .or(z.literal(''))
  .transform((value) => String(value || '').trim())

function hhmmToMinutes(value) {
  const [hh, mm] = String(value).split(':').map(Number)
  return hh * 60 + mm
}

function validateUniqueIds(ids = [], ctx, path) {
  const seen = new Set()

  ids.forEach((id, index) => {
    const normalized = String(id).toLowerCase()

    if (seen.has(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path, index],
        message: 'Duplicate id is not allowed',
      })
    }

    seen.add(normalized)
  })
}

const baseOTRequestSchema = z
  .object({
    employeeIds: z
      .array(objectIdSchema)
      .min(1, 'Please select at least 1 employee')
      .max(200, 'You can select up to 200 employees at one time'),

    otDate: otDateSchema,

    startTime: optionalTimeSchema,
    endTime: optionalTimeSchema,
    breakMinutes: z.coerce
      .number()
      .int()
      .min(0, 'breakMinutes must be at least 0')
      .default(0),

    shiftOtOptionId: z
      .string()
      .trim()
      .default('')
      .refine((value) => !value || /^[a-fA-F0-9]{24}$/.test(value), {
        message: 'shiftOtOptionId must be a valid id',
      }),

    reason: z
      .string()
      .trim()
      .min(1, 'reason is required')
      .max(1000, 'reason must not exceed 1000 characters'),

    approverEmployeeIds: z
      .array(objectIdSchema)
      .min(1, 'Please select at least 1 approver')
      .max(4, 'You can select up to 4 approvers only'),
  })
  .superRefine((data, ctx) => {
    validateUniqueIds(data.employeeIds, ctx, 'employeeIds')
    validateUniqueIds(data.approverEmployeeIds, ctx, 'approverEmployeeIds')

    const hasShiftOtOptionId = Boolean(String(data.shiftOtOptionId || '').trim())
    const hasStartTime = Boolean(String(data.startTime || '').trim())
    const hasEndTime = Boolean(String(data.endTime || '').trim())

    if (!hasShiftOtOptionId) {
      if (!hasStartTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['startTime'],
          message: 'startTime is required when shiftOtOptionId is not provided',
        })
      }

      if (!hasEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endTime'],
          message: 'endTime is required when shiftOtOptionId is not provided',
        })
      }

      if (hasStartTime && hasEndTime) {
        if (hhmmToMinutes(data.endTime) <= hhmmToMinutes(data.startTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endTime'],
            message: 'endTime must be later than startTime',
          })
        }
      }
    }

    if (hasShiftOtOptionId && hasStartTime && hasEndTime) {
      if (hhmmToMinutes(data.endTime) <= hhmmToMinutes(data.startTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endTime'],
          message: 'endTime must be later than startTime',
        })
      }
    }
  })

const createOTRequestSchema = baseOTRequestSchema
const updateOTRequestSchema = baseOTRequestSchema

const unavailableOTEmployeesQuerySchema = z.object({
  otDate: otDateSchema,
})

const listOTRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(''),

  status: z.string().trim().default(''),
  dayType: z.string().trim().default(''),

  employeeId: z.string().trim().default(''),
  departmentId: z.string().trim().default(''),
  positionId: z.string().trim().default(''),

  otDateFrom: z.string().trim().default(''),
  otDateTo: z.string().trim().default(''),

  sortBy: z
    .enum([
      'createdAt',
      'otDate',
      'requestNo',
      'requesterName',
      'status',
      'totalHours',
      'employeeCount',
    ])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const listOTApprovalInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(''),

  status: z.string().trim().default(''),
  dayType: z.string().trim().default(''),
  otDateFrom: z.string().trim().default(''),
  otDateTo: z.string().trim().default(''),

  sortBy: z
    .enum([
      'createdAt',
      'otDate',
      'requestNo',
      'requesterName',
      'status',
      'totalHours',
      'employeeCount',
    ])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const otRequestIdParamSchema = z.object({
  id: objectIdSchema,
})

const otApprovalDecisionSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),

    approvedEmployeeIds: z
      .array(objectIdSchema)
      .max(200, 'You can approve up to 200 employees at one time')
      .default([]),

    remark: z
      .string()
      .trim()
      .max(1000, 'remark must not exceed 1000 characters')
      .default(''),
  })
  .superRefine((data, ctx) => {
    validateUniqueIds(data.approvedEmployeeIds, ctx, 'approvedEmployeeIds')

    if (data.action === 'APPROVE' && !data.approvedEmployeeIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['approvedEmployeeIds'],
        message: 'Please select at least 1 approved employee',
      })
    }

    if (data.action === 'REJECT' && !String(data.remark || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['remark'],
        message: 'remark is required when rejecting',
      })
    }
  })

const otRequesterConfirmationSchema = z
  .object({
    action: z.enum(['AGREE', 'DISAGREE']),
    remark: z
      .string()
      .trim()
      .max(1000, 'remark must not exceed 1000 characters')
      .default(''),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'DISAGREE' && !String(data.remark || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['remark'],
        message: 'remark is required when disagreeing',
      })
    }
  })

module.exports = {
  createOTRequestSchema,
  updateOTRequestSchema,
  listOTRequestsQuerySchema,
  listOTApprovalInboxQuerySchema,
  unavailableOTEmployeesQuerySchema,
  otRequestIdParamSchema,
  otApprovalDecisionSchema,
  otRequesterConfirmationSchema,
}