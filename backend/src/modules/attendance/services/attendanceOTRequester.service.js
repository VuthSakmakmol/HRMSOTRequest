const Account = require('../../auth/models/Account')
const { resolveEffectiveAccess } = require('../../auth/utils/resolveEffectiveAccess')
const Employee = require('../../org/models/Employee')
const AppError = require('../../../shared/errors/AppError')

async function canRequestOT(employee) {
  if (!employee || employee.isActive === false || employee.isOTEligible === false) {
    return false
  }

  const accounts = await Account.find({
    employeeId: employee._id,
    isActive: { $ne: false },
  })
    .select('roleIds directPermissionCodes')
    .lean()

  for (const account of accounts) {
    const access = await resolveEffectiveAccess(account)
    if (access.isRootAdmin || access.permissionCodes.includes('OT_REQUEST_CREATE')) {
      return true
    }
  }

  return false
}

async function resolveAttendanceOTRequester(employee) {
  const manager = employee.reportsToEmployeeId
    ? await Employee.findById(employee.reportsToEmployeeId).lean()
    : null

  if (await canRequestOT(manager)) return manager
  if (await canRequestOT(employee)) return employee

  throw new AppError({
    statusCode: 403,
    code: 'ATTENDANCE_OT_REQUESTER_NOT_ALLOWED',
    messageKey: 'attendance.verification.requesterNotAllowed',
    message: 'Neither the employee nor their direct manager can request OT. Grant OT request permission to an eligible employee or assign a manager who can request OT.',
  })
}

module.exports = { resolveAttendanceOTRequester }
