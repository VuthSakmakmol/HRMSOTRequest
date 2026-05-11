// backend/src/modules/auth/services/permission-resolver.service.js

const { resolveEffectiveAccess } = require('../utils/resolveEffectiveAccess')

function normalizeRoleIds(values = []) {
  if (!Array.isArray(values)) return []

  return [
    ...new Set(
      values
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  ]
}

async function resolvePermissionContext(account) {
  const effectiveAccess = await resolveEffectiveAccess(account)

  return {
    roleIds: normalizeRoleIds(account?.roleIds || []),
    directPermissionCodes: effectiveAccess.directPermissionCodes || [],
    rolePermissionCodes: effectiveAccess.rolePermissionCodes || [],
    effectivePermissionCodes: effectiveAccess.permissionCodes || [],
    roles: effectiveAccess.roles || [],
  }
}

module.exports = {
  resolvePermissionContext,
}