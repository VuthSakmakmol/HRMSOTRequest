// backend/src/modules/ot/services/otApprovalCalendarRule.service.js

const mongoose = require('mongoose')

const AppError = require('../../../shared/errors/AppError')
const Employee = require('../../org/models/Employee')
const OTApprovalCalendarRule = require('../models/OTApprovalCalendarRule')

const ROLE_FIELDS_BY_DAY_TYPE = {
  WORKING_DAY: 'workingDayRole',
  SUNDAY: 'sundayRole',
  HOLIDAY: 'holidayRole',
}

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

function id(value) {
  return value ? String(value?._id || value?.id || value) : ''
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''))
}

function actorAccountId(authUser = {}) {
  const value = authUser.accountId || authUser.id || authUser._id
  return isObjectId(value) ? value : null
}

function employeeCode(employee = {}) {
  return s(employee.employeeNo || employee.employeeCode || employee.code)
}

function employeeName(employee = {}) {
  return s(employee.displayName || employee.employeeName || employee.name)
}

function roleFieldForDayType(dayType) {
  return ROLE_FIELDS_BY_DAY_TYPE[upper(dayType)] || 'workingDayRole'
}

function roleValue(value) {
  const normalized = upper(value || 'USE_DEFAULT')
  return OT_APPROVAL_CALENDAR_ROLES.includes(normalized)
    ? normalized
    : 'USE_DEFAULT'
}

function appError({ statusCode = 400, code, messageKey, message, field = null, params = {} }) {
  return new AppError({
    statusCode,
    code,
    messageKey,
    message,
    field,
    params,
  })
}

function toItem(doc = {}, employee = null) {
  const currentEmployee = employee || {}
  const code = employeeCode(currentEmployee) || s(doc.employeeCode)
  const name = employeeName(currentEmployee) || s(doc.employeeName)

  return {
    id: id(doc._id),
    employeeId: id(doc.employeeId),
    employeeCode: code,
    employeeName: name,
    employeeLabel: [code, name].filter(Boolean).join(' · ') || id(doc.employeeId),

    workingDayRole: roleValue(doc.workingDayRole),
    sundayRole: roleValue(doc.sundayRole),
    holidayRole: roleValue(doc.holidayRole),

    isActive: doc.isActive !== false,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  }
}

async function listRules() {
  const docs = await OTApprovalCalendarRule.find({})
    .sort({ employeeName: 1, employeeCode: 1, _id: 1 })
    .lean()

  const employeeIds = docs.map((doc) => doc.employeeId).filter(Boolean)
  const employees = employeeIds.length
    ? await Employee.find({ _id: { $in: employeeIds } })
      .select('_id employeeNo employeeCode displayName employeeName name isActive otWorkflowRole')
      .lean()
    : []

  const employeeById = new Map(employees.map((employee) => [id(employee._id), employee]))

  const items = docs
    .map((doc) => toItem(doc, employeeById.get(id(doc.employeeId)) || null))
    .sort((a, b) => a.employeeLabel.localeCompare(b.employeeLabel))

  return {
    items,
    roles: OT_APPROVAL_CALENDAR_ROLES,
  }
}

async function listEmployeeOptions(query = {}) {
  const search = s(query.search)
  const limit = Math.min(Math.max(Number(query.limit || 50), 1), 100)

  const filter = { isActive: { $ne: false } }

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

    filter.$or = [
      { employeeNo: regex },
      { employeeCode: regex },
      { displayName: regex },
      { employeeName: regex },
      { name: regex },
    ]
  }

  const employees = await Employee.find(filter)
    .select('_id employeeNo employeeCode displayName employeeName name otWorkflowRole isActive')
    .sort({ employeeNo: 1, employeeCode: 1, displayName: 1, _id: 1 })
    .limit(limit)
    .lean()

  return {
    items: employees.map((employee) => {
      const code = employeeCode(employee)
      const name = employeeName(employee)

      return {
        employeeId: id(employee._id),
        employeeCode: code,
        employeeName: name,
        employeeLabel: [code, name].filter(Boolean).join(' · ') || id(employee._id),
        defaultWorkflowRole: upper(employee.otWorkflowRole || 'NONE'),
      }
    }),
  }
}

async function upsertRule(employeeId, payload = {}, authUser = {}) {
  const cleanEmployeeId = s(employeeId)

  if (!isObjectId(cleanEmployeeId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_EMPLOYEE_ID',
      messageKey: 'common.validation.invalidId',
      message: 'Invalid employee id',
      field: 'employeeId',
    })
  }

  const employee = await Employee.findById(cleanEmployeeId)
    .select('_id employeeNo employeeCode displayName employeeName name isActive otWorkflowRole')
    .lean()

  if (!employee) {
    throw appError({
      statusCode: 404,
      code: 'EMPLOYEE_NOT_FOUND',
      messageKey: 'employee.error.notFound',
      message: 'Employee not found',
      field: 'employeeId',
    })
  }

  if (employee.isActive === false) {
    throw appError({
      statusCode: 400,
      code: 'INACTIVE_EMPLOYEE_NOT_ALLOWED',
      messageKey: 'employee.error.inactive',
      message: 'Inactive employees cannot be configured in the OT approval calendar',
      field: 'employeeId',
    })
  }

  const actor = actorAccountId(authUser)
  const update = {
    employeeId: employee._id,
    employeeCode: employeeCode(employee),
    employeeName: employeeName(employee),

    workingDayRole: roleValue(payload.workingDayRole),
    sundayRole: roleValue(payload.sundayRole),
    holidayRole: roleValue(payload.holidayRole),

    isActive: payload.isActive !== false,
    updatedBy: actor,
  }

  const doc = await OTApprovalCalendarRule.findOneAndUpdate(
    { employeeId: employee._id },
    {
      $set: update,
      $setOnInsert: {
        createdBy: actor,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()

  return toItem(doc, employee)
}

async function resetRule(employeeId) {
  const cleanEmployeeId = s(employeeId)

  if (!isObjectId(cleanEmployeeId)) {
    throw appError({
      statusCode: 400,
      code: 'INVALID_EMPLOYEE_ID',
      messageKey: 'common.validation.invalidId',
      message: 'Invalid employee id',
      field: 'employeeId',
    })
  }

  await OTApprovalCalendarRule.deleteOne({ employeeId: cleanEmployeeId })

  return {
    employeeId: cleanEmployeeId,
    reset: true,
  }
}

// Used by ot.service when a request is created or edited. It returns only an
// explicit calendar role. `USE_DEFAULT` and no rule both intentionally fall
// back to the employee's existing otWorkflowRole.
async function getExplicitRolesByEmployeeIds(employeeIds = [], dayType = 'WORKING_DAY') {
  const ids = [...new Set((Array.isArray(employeeIds) ? employeeIds : []).map(id).filter(isObjectId))]

  if (!ids.length) return new Map()

  const roleField = roleFieldForDayType(dayType)
  const docs = await OTApprovalCalendarRule.find({
    employeeId: { $in: ids },
    isActive: { $ne: false },
  })
    .select({ employeeId: 1, [roleField]: 1 })
    .lean()

  const result = new Map()

  for (const doc of docs) {
    const value = roleValue(doc[roleField])
    if (value !== 'USE_DEFAULT') {
      result.set(id(doc.employeeId), value)
    }
  }

  return result
}

module.exports = {
  OT_APPROVAL_CALENDAR_ROLES,
  listRules,
  listEmployeeOptions,
  upsertRule,
  resetRule,
  getExplicitRolesByEmployeeIds,
}
