// backend/src/modules/auth/utils/resolveEffectiveAccess.js

const SystemRole = require('../../access/models/SystemRole')
const Permission = require('../../access/models/Permission')

const ROOT_ADMIN_CODE = 'ROOT_ADMIN'

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

function uniqueCodes(values = []) {
  return [...new Set(values.map(normalizeCode).filter(Boolean))]
}

async function resolveEffectiveAccess(account) {
  const directPermissionCodes = uniqueCodes(account?.directPermissionCodes || [])
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

  const roleCodes = uniqueCodes(roles.map((role) => role.code))
  const isRootAdmin = roleCodes.includes(ROOT_ADMIN_CODE)

  const rolePermissionCodes = uniqueCodes(
    roles.flatMap((role) =>
      Array.isArray(role.permissionIds)
        ? role.permissionIds.map((permission) => permission?.code)
        : [],
    ),
  )

  let permissionCodes = uniqueCodes([...rolePermissionCodes, ...directPermissionCodes])

  // Root admin should be able to see all permission-based sidebar/menu items too.
  // requirePermission already bypasses root admin, but frontend menu still needs codes.
  if (isRootAdmin) {
    const allPermissions = await Permission.find({
      isActive: { $ne: false },
    })
      .select('code')
      .lean()

    permissionCodes = uniqueCodes([
      ...permissionCodes,
      ...allPermissions.map((permission) => permission.code),
    ])
  }

  return {
    roleCodes,
    permissionCodes,
    rolePermissionCodes,
    directPermissionCodes,
    isRootAdmin,
    roles: roles.map((role) => ({
      id: String(role._id),
      code: normalizeCode(role.code),
      displayName: role.displayName || role.code || '',
    })),
  }
}

module.exports = {
  ROOT_ADMIN_CODE,
  resolveEffectiveAccess,
}