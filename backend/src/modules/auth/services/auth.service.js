// backend/src/modules/auth/services/auth.service.js
const Account = require('../models/Account')
const { signAccessToken } = require('../../../shared/utils/jwt')
const { resolveEffectiveAccess } = require('../utils/resolveEffectiveAccess')

async function login({ loginId, password }) {
  const normalizedLoginId = String(loginId || '').trim().toLowerCase()

  const account = await Account.findOne({
    loginId: normalizedLoginId,
    isActive: true,
  }).select('+passwordHash')

  if (!account) {
    const err = new Error('Invalid login credentials')
    err.status = 401
    throw err
  }

  const ok = await account.comparePassword(password)
  if (!ok) {
    const err = new Error('Invalid login credentials')
    err.status = 401
    throw err
  }

  const effectiveAccess = await resolveEffectiveAccess(account)

  const token = signAccessToken({
    sub: String(account._id),
    loginId: account.loginId,
    passwordVersion: account.passwordVersion || 1,
  })

  return {
    token,
    user: {
      accountId: String(account._id),
      id: String(account._id),
      loginId: account.loginId,
      displayName: account.displayName,
      employeeId: account.employeeId ? String(account.employeeId) : null,
      roleIds: Array.isArray(account.roleIds) ? account.roleIds.map(String) : [],
      roleCodes: effectiveAccess.roleCodes,
      roles: effectiveAccess.roleCodes,
      directPermissionCodes: Array.isArray(account.directPermissionCodes)
        ? account.directPermissionCodes
        : [],
      effectivePermissionCodes: effectiveAccess.permissionCodes,
      passwordVersion: account.passwordVersion || 1,
      mustChangePassword: !!account.mustChangePassword,
      isRootAdmin: !!effectiveAccess.isRootAdmin,
      isActive: !!account.isActive,
    },
  }
}

module.exports = {
  login,
}