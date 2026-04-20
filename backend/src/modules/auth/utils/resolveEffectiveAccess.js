// backend/src/modules/auth/utils/resolveEffectiveAccess.js
const SystemRole = require('../../access/models/SystemRole')

const ROOT_ADMIN_CODE = 'ROOT_ADMIN'

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

async function resolveEffectiveAccess(account) {
  const directPermissionCodes = Array.isArray(account?.directPermissionCodes)
    ? account.directPermissionCodes.map(normalizeCode).filter(Boolean)
    : []

  const roleIds = Array.isArray(account?.roleIds) ? account.roleIds : []

  const roles = roleIds.length
    ? await SystemRole.find({
        _id: { $in: roleIds },
        isActive: { $ne: false },
      })
        .populate({
          path: 'permissionIds',
          select: 'code isActive',
          match: { isActive: true },
          options: { sort: { module: 1, code: 1 } },
        })
        .select('_id code displayName permissionIds')
        .lean()
    : []

  const roleCodes = roles.map((role) => normalizeCode(role.code)).filter(Boolean)

  const isRootAdmin = roleCodes.includes(ROOT_ADMIN_CODE)

  const rolePermissionCodes = roles.flatMap((role) =>
    Array.isArray(role.permissionIds)
      ? role.permissionIds.map((permission) => normalizeCode(permission?.code)).filter(Boolean)
      : [],
  )

  const permissionCodes = [...new Set([...rolePermissionCodes, ...directPermissionCodes])]

  return {
    roleCodes,
    permissionCodes,
    isRootAdmin,
  }
}

module.exports = {
  ROOT_ADMIN_CODE,
  resolveEffectiveAccess,
}