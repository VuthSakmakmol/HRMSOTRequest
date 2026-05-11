// backend/src/modules/auth/utils/buildAuthUser.js

const { resolveEffectiveAccess } = require('./resolveEffectiveAccess')

async function buildAuthUser(account, options = {}) {
  const effectiveAccess = options.effectiveAccess || (await resolveEffectiveAccess(account))

  return {
    accountId: String(account._id),
    id: String(account._id),
    loginId: account.loginId,
    displayName: account.displayName,
    employeeId: account.employeeId ? String(account.employeeId) : null,

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

module.exports = {
  buildAuthUser,
}