// backend/src/modules/auth/utils/buildAuthUser.js

const { resolveEffectiveAccess } = require('./resolveEffectiveAccess')

function s(value) {
  return String(value ?? '').trim()
}

function id(value) {
  if (!value) return ''

  return s(value?._id || value?.id || value)
}

function buildShiftSummary(shiftValue) {
  if (!shiftValue || typeof shiftValue !== 'object') return null

  const shiftId = id(shiftValue)
  if (!shiftId) return null

  const code = s(shiftValue.code)
  const name = s(shiftValue.name)
  const type = s(shiftValue.type)
  const startTime = s(shiftValue.startTime)
  const breakStartTime = s(shiftValue.breakStartTime)
  const breakEndTime = s(shiftValue.breakEndTime)
  const endTime = s(shiftValue.endTime)
  const crossMidnight = shiftValue.crossMidnight === true

  return {
    shiftId,
    shiftCode: code,
    shiftName: name,
    shiftType: type,
    shiftStartTime: startTime,
    shiftEndTime: endTime,
    shiftBreakStartTime: breakStartTime,
    shiftBreakEndTime: breakEndTime,
    shiftCrossMidnight: crossMidnight,
    shift: {
      id: shiftId,
      _id: shiftId,
      code,
      name,
      type,
      startTime,
      breakStartTime,
      breakEndTime,
      endTime,
      crossMidnight,
    },
  }
}

function buildEmployeeSummary(employeeValue) {
  if (!employeeValue || typeof employeeValue !== 'object') return null

  const employeeId = id(employeeValue)
  if (!employeeId) return null

  const employeeCode = s(employeeValue.employeeCode || employeeValue.employeeNo)
  const displayName = s(employeeValue.displayName || employeeValue.name)
  const shiftSummary = buildShiftSummary(employeeValue.shiftId) || {}

  return {
    id: employeeId,
    _id: employeeId,
    employeeId,
    employeeCode,
    employeeNo: employeeCode,
    displayName,
    employeeLabel: [employeeCode, displayName].filter(Boolean).join(' - ') || displayName || employeeId,
    ...shiftSummary,
  }
}

function getAccountEmployeeId(account) {
  return id(account?.employeeId)
}

async function buildAuthUser(account, options = {}) {
  const effectiveAccess = options.effectiveAccess || (await resolveEffectiveAccess(account))
  const employee = buildEmployeeSummary(account.employeeId)
  const employeeId = employee?.employeeId || getAccountEmployeeId(account) || null

  return {
    accountId: String(account._id),
    id: String(account._id),
    loginId: account.loginId,
    displayName: account.displayName,
    employeeId,
    employee,

    roleIds: Array.isArray(account.roleIds) ? account.roleIds.map(String) : [],
    roleCodes: Array.isArray(effectiveAccess.roleCodes) ? effectiveAccess.roleCodes : [],
    roles: Array.isArray(effectiveAccess.roleCodes) ? effectiveAccess.roleCodes : [],

    directPermissionCodes: Array.isArray(account.directPermissionCodes)
      ? account.directPermissionCodes
      : [],

    effectivePermissionCodes: Array.isArray(effectiveAccess.permissionCodes)
      ? effectiveAccess.permissionCodes
      : [],

    passwordVersion: Number(account.passwordVersion || 1),
    mustChangePassword: !!account.mustChangePassword,
    isRootAdmin: !!effectiveAccess.isRootAdmin,
    isActive: !!account.isActive,
  }
}

const AUTH_EMPLOYEE_POPULATE = {
  path: 'employeeId',
  select: 'employeeCode displayName shiftId isActive',
  populate: {
    path: 'shiftId',
    select: 'code name type startTime breakStartTime breakEndTime endTime crossMidnight isActive',
  },
}

module.exports = {
  AUTH_EMPLOYEE_POPULATE,
  buildAuthUser,
}
