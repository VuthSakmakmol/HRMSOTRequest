// backend/src/modules/org/validators/employee.validation.js

const { z } = require('zod')
const mongoose = require('mongoose')

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value))
}

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

function toBoolean(value, defaultValue = undefined) {
  if (value === undefined) return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1

  const v = String(value).trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(v)) return true
  if (['false', '0', 'no', 'n'].includes(v)) return false

  return defaultValue
}

const objectIdField = (label) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((value) => isObjectId(value), `Invalid ${label}`)

const optionalObjectIdField = (label) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return null
      const v = String(value).trim()
      return v || null
    })
    .refine((value) => value === null || isObjectId(value), `Invalid ${label}`)

const joinDateField = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null || value === '') return null
    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? 'INVALID_DATE' : date
  })
  .refine((value) => value === null || value !== 'INVALID_DATE', 'Invalid joinDate')

const phoneField = z
  .string()
  .trim()
  .max(30, 'Phone is too long')
  .optional()
  .default('')

const emailField = z
  .string()
  .trim()
  .email('Invalid email')
  .max(150, 'Email is too long')
  .optional()
  .or(z.literal(''))
  .default('')

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional().default(''),
  departmentId: z.string().trim().optional().default(''),
  positionId: z.string().trim().optional().default(''),
  lineId: z.string().trim().optional().default(''),
  shiftId: z.string().trim().optional().default(''),
  isActive: booleanLike,
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'employeeNo',
      'displayName',
      'joinDate',
      'isActive',
    ])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const exportQuerySchema = z.object({
  search: z.string().trim().optional().default(''),
  departmentId: z.string().trim().optional().default(''),
  positionId: z.string().trim().optional().default(''),
  lineId: z.string().trim().optional().default(''),
  shiftId: z.string().trim().optional().default(''),
  isActive: booleanLike,
  sortBy: z
    .enum([
      'createdAt',
      'updatedAt',
      'employeeNo',
      'displayName',
      'joinDate',
      'isActive',
    ])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const createEmployeeSchema = z
  .object({
    employeeNo: z
      .string()
      .trim()
      .min(1, 'Employee No is required')
      .max(50, 'Employee No is too long'),

    displayName: z
      .string()
      .trim()
      .min(1, 'Display Name is required')
      .max(150, 'Display Name is too long'),

    departmentId: objectIdField('Department'),
    positionId: objectIdField('Position'),

    // Optional because some office/admin employees may not belong to a production line.
    lineId: optionalObjectIdField('Line'),

    shiftId: objectIdField('Shift'),

    // Manual manager is still accepted, but service will auto-overwrite it when:
    // position.reportsToPositionId exists AND lineId exists.
    reportsToEmployeeId: optionalObjectIdField('reportsToEmployeeId'),

    phone: phoneField,
    email: emailField,
    joinDate: joinDateField,
    isActive: z.boolean().optional().default(true),
    createAccount: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.createAccount && !String(data.phone || '').trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Phone is required when creating account',
      })
    }
  })

const updateEmployeeSchema = z
  .object({
    employeeNo: z
      .string()
      .trim()
      .min(1, 'Employee No is required')
      .max(50, 'Employee No is too long')
      .optional(),

    displayName: z
      .string()
      .trim()
      .min(1, 'Display Name is required')
      .max(150, 'Display Name is too long')
      .optional(),

    departmentId: objectIdField('Department').optional(),
    positionId: objectIdField('Position').optional(),
    lineId: optionalObjectIdField('Line').optional(),
    shiftId: objectIdField('Shift').optional(),
    reportsToEmployeeId: optionalObjectIdField('reportsToEmployeeId').optional(),

    phone: z.string().trim().max(30, 'Phone is too long').optional(),

    email: z
      .string()
      .trim()
      .email('Invalid email')
      .max(150, 'Email is too long')
      .optional()
      .or(z.literal('')),

    joinDate: joinDateField.optional(),
    isActive: z.boolean().optional(),
    provisionAccount: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const hasAnyNormalField =
      data.employeeNo !== undefined ||
      data.displayName !== undefined ||
      data.departmentId !== undefined ||
      data.positionId !== undefined ||
      data.lineId !== undefined ||
      data.shiftId !== undefined ||
      data.reportsToEmployeeId !== undefined ||
      data.phone !== undefined ||
      data.email !== undefined ||
      data.joinDate !== undefined ||
      data.isActive !== undefined

    if (!hasAnyNormalField && data.provisionAccount !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: 'At least one field is required',
      })
    }

    if (
      data.provisionAccount === true &&
      data.phone !== undefined &&
      !String(data.phone || '').trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Phone is required when provisioning account',
      })
    }
  })

const importEmployeeRowSchema = z.object({
  employeeNo: z
    .string()
    .trim()
    .min(1, 'Employee No is required')
    .max(50, 'Employee No is too long'),

  displayName: z
    .string()
    .trim()
    .min(1, 'Display Name is required')
    .max(150, 'Display Name is too long'),

  departmentCode: z
    .string()
    .trim()
    .min(1, 'Department Code is required')
    .max(50, 'Department Code is too long'),

  positionCode: z
    .string()
    .trim()
    .min(1, 'Position Code is required')
    .max(50, 'Position Code is too long'),

  lineCode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }),

  shiftCode: z
    .string()
    .trim()
    .min(1, 'Shift Code is required')
    .max(50, 'Shift Code is too long'),

  reportsToEmployeeNo: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    }),

  phone: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return ''
      return String(value).trim()
    })
    .refine((value) => value.length <= 30, 'Phone is too long'),

  email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return ''
      return String(value).trim().toLowerCase()
    })
    .refine(
      (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Invalid email',
    )
    .refine((value) => value.length <= 150, 'Email is too long'),

  joinDate: z
    .union([z.string(), z.date(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null || value === '') return null
      const date = value instanceof Date ? value : new Date(value)
      return Number.isNaN(date.getTime()) ? 'INVALID_DATE' : date
    })
    .refine((value) => value === null || value !== 'INVALID_DATE', 'Invalid joinDate'),

  isActive: z
    .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null || value === '') return true
      return toBoolean(value, 'INVALID_BOOLEAN')
    })
    .refine((value) => value !== 'INVALID_BOOLEAN', 'Invalid isActive'),
})

function normalizeListQuery(raw = {}) {
  const parsed = listQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search,
    departmentId: parsed.departmentId,
    positionId: parsed.positionId,
    lineId: parsed.lineId,
    shiftId: parsed.shiftId,
    isActive: toBoolean(parsed.isActive),
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  }
}

function normalizeExportQuery(raw = {}) {
  const parsed = exportQuerySchema.parse(raw)

  return {
    search: parsed.search,
    departmentId: parsed.departmentId,
    positionId: parsed.positionId,
    lineId: parsed.lineId,
    shiftId: parsed.shiftId,
    isActive: toBoolean(parsed.isActive),
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
  }
}

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  importEmployeeRowSchema,
  normalizeListQuery,
  normalizeExportQuery,
}