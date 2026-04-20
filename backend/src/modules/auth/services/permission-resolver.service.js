// backend/src/modules/auth/services/permission-resolver.service.js
const SystemRole = require('../../org/models/SystemRole')

function s(v) {
  return String(v ?? '').trim()
}

function up(v) {
  return s(v).toUpperCase()
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(up).filter(Boolean))]
}

function normalizeRoleIds(values = []) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(v => s(v)).filter(Boolean))]
}

async function resolvePermissionContext(account) {
  const roleIds = normalizeRoleIds(account?.roleIds)
  const directPermissionCodes = uniqueStrings(account?.directPermissionCodes || [])

  let roles = []
  let rolePermissionCodes = []

  if (roleIds.length) {
    roles = await SystemRole.find({
      _id: { $in: roleIds },
      isActive: true,
    })
      .populate({
        path: 'permissionIds',
        select: 'code isActive',
        match: { isActive: true },
        options: { sort: { module: 1, code: 1 } },
      })
      .select('_id code displayName permissionIds')
      .lean()

    rolePermissionCodes = uniqueStrings(
      roles.flatMap(role =>
        Array.isArray(role?.permissionIds)
          ? role.permissionIds.map(permission => permission?.code)
          : []
      )
    )
  }

  const effectivePermissionCodes = uniqueStrings([
    ...rolePermissionCodes,
    ...directPermissionCodes,
  ])

  return {
    roleIds,
    directPermissionCodes,
    rolePermissionCodes,
    effectivePermissionCodes,
    roles: roles.map(role => ({
      id: String(role._id),
      code: role.code || '',
      displayName: role.displayName || role.code || '',
    })),
  }
}

module.exports = {
  resolvePermissionContext,
}