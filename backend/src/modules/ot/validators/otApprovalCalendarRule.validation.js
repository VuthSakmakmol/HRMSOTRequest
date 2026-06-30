// backend/src/modules/ot/validators/otApprovalCalendarRule.validation.js

const mongoose = require('mongoose')
const { z } = require('zod')

const OT_APPROVAL_CALENDAR_ROLES = [
  'USE_DEFAULT',
  'SKIP',
  'APPROVER',
  'FINAL_APPROVER',
  'ACKNOWLEDGE',
]

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

const employeeIdSchema = z
  .string()
  .trim()
  .min(1, 'common.validation.idRequired')
  .refine((value) => isObjectId(value), 'common.validation.invalidId')

const calendarRoleSchema = z
  .string()
  .trim()
  .optional()
  .default('USE_DEFAULT')
  .transform((value) => upper(value || 'USE_DEFAULT'))
  .refine(
    (value) => OT_APPROVAL_CALENDAR_ROLES.includes(value),
    'ot.approvalCalendarRules.validation.roleInvalid',
  )

const booleanLike = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return true
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1

    return ['true', '1', 'yes', 'y', 'active'].includes(s(value).toLowerCase())
  })

const calendarRuleEmployeeParamSchema = z.object({
  employeeId: employeeIdSchema,
})

const upsertCalendarRuleSchema = z.object({
  workingDayRole: calendarRoleSchema,
  sundayRole: calendarRoleSchema,
  holidayRole: calendarRoleSchema,
  isActive: booleanLike,
})

const employeeOptionsQuerySchema = z.object({
  search: z.string().trim().max(120, 'common.validation.searchTooLong').optional().default(''),
  limit: z.coerce.number().int().min(1, 'common.validation.limitInvalid').max(100, 'common.validation.limitInvalid').default(50),
})

module.exports = {
  calendarRuleEmployeeParamSchema,
  upsertCalendarRuleSchema,
  employeeOptionsQuerySchema,
}
