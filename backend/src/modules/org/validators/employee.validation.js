// backend/src/modules/org/validators/employee.validation.js

const { z } = require('zod')
const mongoose = require('mongoose')

function s(value) {
  return String(value ?? '').trim()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value))
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

function normalizeOTWorkflowRole(value) {
  const role = s(value || 'NONE').toUpperCase()

  return ['NONE', 'APPROVER', 'ACKNOWLEDGE'].includes(role) ? role : 'NONE'
}

const objectIdField = (fieldKey) =>
  z
    .string()
    .trim()
    .min(1, `${fieldKey}.required`)
    .refine((value) => isObjectId(value), `${fieldKey}.invalid`)

const optionalObjectIdField = (fieldKey) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === undefined || value === null) return null

      const text = s(value)

      return text || null
    })
    .refine((value) => value === null || isObjectId(value), `${fieldKey}.invalid`)

const objectIdArrayField = (fieldKey) =>
  z
    .array(
      z
        .string()
        .trim()
        .refine((value) => isObjectId(value), `${fieldKey}.invalid`),
    )
    .optional()
    .default([])

const booleanLike = z.union([z.boolean(), z.string(), z.number()]).optional()

const employeeCodeRequiredField = z
  .string()
  .trim()
  .min(1, 'org.employee.validation.employeeCodeRequired')
  .max(50, 'org.employee.validation.employeeCodeTooLong')
  .transform((value) => s(value).toUpperCase())

const employeeCodeOptionalField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => s(value).toUpperCase())
  .refine((value) => value.length <= 50, 'org.employee.validation.employeeCodeTooLong')

const displayNameField = z
  .string()
  .trim()
  .min(1, 'org.employee.validation.displayNameRequired')
  .max(150, 'org.employee.validation.displayNameTooLong')

const phoneField = z
  .string()
  .trim()
  .max(30, 'org.employee.validation.phoneTooLong')
  .optional()
  .default('')

const joinDateField = z
  .union([z.string(), z.date(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === undefined || value === null || value === '') return null

    const date = value instanceof Date ? value : new Date(value)

    return Number.isNaN(date.getTime()) ? 'INVALID_DATE' : date
  })
  .refine(
    (value) => value === null || value !== 'INVALID_DATE',
    'org.employee.validation.joinDateInvalid',
  )

const otWorkflowRoleField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => normalizeOTWorkflowRole(value))
  .refine(
    (value) => ['NONE', 'APPROVER', 'ACKNOWLEDGE'].includes(value),
    'org.employee.validation.otWorkflowRoleInvalid',
  )

const createAccountOptionSchema = z
  .object({
    enabled: z.boolean().optional().default(false),

    loginId: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((value) => s(value).toLowerCase())
      .refine(
        (value) => value.length <= 100,
        'auth.account.validation.loginIdTooLong',
      ),

    password: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((value) => s(value))
      .refine(
        (value) => !value || value.length >= 6,
        'auth.account.validation.passwordMinLength',
      )
      .refine(
        (value) => value.length <= 100,
        'auth.account.validation.passwordMaxLength',
      ),

    mustChangePassword: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true),
  })
  .optional()
  .default({ enabled: false })

const listEmployeeQuerySchema = z.object({
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
      'employeeCode',
      'displayName',
      'joinDate',
      'isActive',
      'otWorkflowRole',
    ])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const exportEmployeeQuerySchema = listEmployeeQuerySchema.omit({
  page: true,
  limit: true,
})

const lookupEmployeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().optional().default(''),
  q: z.string().trim().optional().default(''),

  departmentId: z.string().trim().optional().default(''),
  positionId: z.string().trim().optional().default(''),
  lineId: z.string().trim().optional().default(''),
  shiftId: z.string().trim().optional().default(''),
  reportsToEmployeeId: z.string().trim().optional().default(''),

  // Used by OT employee multipicker only.
  // true = return only employees that belong to at least one production line.
  otEligibleOnly: booleanLike,
  hasLineOnly: booleanLike,

  isActive: booleanLike,

  scope: z
    .string()
    .trim()
    .optional()
    .default('MANAGED')
    .transform((value) => {
      const scope = s(value).toUpperCase()

      return ['MANAGED', 'ALL'].includes(scope) ? scope : 'MANAGED'
    }),
})

const createEmployeeSchema = z.object({
  employeeCode: employeeCodeRequiredField,

  displayName: displayNameField,

  departmentId: objectIdField('org.employee.field.departmentId'),
  positionId: objectIdField('org.employee.field.positionId'),
  lineId: optionalObjectIdField('org.employee.field.lineId'),
  lineIds: objectIdArrayField('org.employee.field.lineIds'),
  shiftId: objectIdField('org.employee.field.shiftId'),

  reportsToEmployeeId: optionalObjectIdField('org.employee.field.reportsToEmployeeId'),

  otWorkflowRole: otWorkflowRoleField.default('NONE'),

  phone: phoneField,
  joinDate: joinDateField,

  createAccount: createAccountOptionSchema,

  isActive: z.boolean().optional().default(true),
})

const updateEmployeeSchema = z
  .object({
    employeeCode: employeeCodeRequiredField.optional(),

    displayName: displayNameField.optional(),

    departmentId: objectIdField('org.employee.field.departmentId').optional(),
    positionId: objectIdField('org.employee.field.positionId').optional(),
    lineId: optionalObjectIdField('org.employee.field.lineId').optional(),
    lineIds: objectIdArrayField('org.employee.field.lineIds').optional(),
    shiftId: objectIdField('org.employee.field.shiftId').optional(),

    reportsToEmployeeId: optionalObjectIdField(
      'org.employee.field.reportsToEmployeeId',
    ).optional(),

    otWorkflowRole: otWorkflowRoleField.optional(),

    phone: z.string().trim().max(30, 'org.employee.validation.phoneTooLong').optional(),

    joinDate: joinDateField.optional(),

    isActive: z.boolean().optional(),

    // Used only when editing an employee that does not yet have an account.
    // Backend remains source of truth: if enabled=true, service validates phone, login ID,
    // password rule, duplicate account, and duplicate login ID.
    createAccount: createAccountOptionSchema.optional(),
  })
  .refine(
    (value) =>
      value.employeeCode !== undefined ||
      value.displayName !== undefined ||
      value.departmentId !== undefined ||
      value.positionId !== undefined ||
      value.lineId !== undefined ||
      value.lineIds !== undefined ||
      value.shiftId !== undefined ||
      value.reportsToEmployeeId !== undefined ||
      value.otWorkflowRole !== undefined ||
      value.phone !== undefined ||
      value.joinDate !== undefined ||
      value.isActive !== undefined ||
      value.createAccount !== undefined,
    {
      message: 'org.employee.validation.updatePayloadRequired',
    },
  )
// Import rule:
// - Employee Code is required.
// - If Employee Code already exists, update that employee.
// - If Employee Code does not exist, create a new employee.
// - Users never need Mongo Employee ID in Excel.
const importEmployeeRowSchema = z.object({
  employeeCode: employeeCodeRequiredField,

  displayName: displayNameField,

  departmentCode: z
    .string()
    .trim()
    .min(1, 'org.employee.validation.departmentCodeRequired')
    .max(50, 'org.employee.validation.departmentCodeTooLong')
    .transform((value) => s(value).toUpperCase()),

  positionCode: z
    .string()
    .trim()
    .min(1, 'org.employee.validation.positionCodeRequired')
    .max(50, 'org.employee.validation.positionCodeTooLong')
    .transform((value) => s(value).toUpperCase()),

  lineCode: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value).toUpperCase()),

  shiftCode: z
    .string()
    .trim()
    .min(1, 'org.employee.validation.shiftCodeRequired')
    .max(50, 'org.employee.validation.shiftCodeTooLong')
    .transform((value) => s(value).toUpperCase()),

  reportsToEmployeeCode: employeeCodeOptionalField,

  otWorkflowRole: otWorkflowRoleField.default('NONE'),

  phone: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => s(value))
    .refine((value) => value.length <= 30, 'org.employee.validation.phoneTooLong'),

  joinDate: joinDateField,

  isActive: z
    .union([z.boolean(), z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => toBoolean(value, true))
    .refine(
      (value) => typeof value === 'boolean',
      'org.employee.validation.isActiveInvalid',
    ),
})

function normalizeListQuery(raw = {}) {
  const parsed = listEmployeeQuerySchema.parse(raw)

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
  const parsed = exportEmployeeQuerySchema.parse(raw)

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

function normalizeLookupQuery(raw = {}) {
  const parsed = lookupEmployeeQuerySchema.parse(raw)

  return {
    page: parsed.page,
    limit: parsed.limit,
    search: parsed.search || parsed.q,
    departmentId: parsed.departmentId,
    positionId: parsed.positionId,
    lineId: parsed.lineId,
    shiftId: parsed.shiftId,
    reportsToEmployeeId: parsed.reportsToEmployeeId,
    isActive: toBoolean(parsed.isActive, true),
    scope: parsed.scope,
    otEligibleOnly:
      toBoolean(parsed.otEligibleOnly, false) ||
      toBoolean(parsed.hasLineOnly, false),
  }
}

module.exports = {
  createEmployeeSchema,
  updateEmployeeSchema,
  importEmployeeRowSchema,
  normalizeListQuery,
  normalizeExportQuery,
  normalizeLookupQuery,
}