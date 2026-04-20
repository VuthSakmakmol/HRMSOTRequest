// backend/src/middlewares/requireAuth.js
const { verifyAccessToken } = require('../shared/utils/jwt')
const Account = require('../modules/auth/models/Account')
const { resolveEffectiveAccess } = require('../modules/auth/utils/resolveEffectiveAccess')

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const [type, token] = authHeader.split(' ')

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({
        ok: false,
        message: 'Unauthorized',
      })
    }

    const payload = verifyAccessToken(token)

    const account = await Account.findById(payload.sub).lean()
    if (!account || !account.isActive) {
      return res.status(401).json({
        ok: false,
        message: 'Unauthorized',
      })
    }

    const tokenPasswordVersion = Number(payload.passwordVersion || 1)
    const currentPasswordVersion = Number(account.passwordVersion || 1)

    if (tokenPasswordVersion !== currentPasswordVersion) {
      return res.status(401).json({
        ok: false,
        message: 'Session expired. Please login again.',
      })
    }

    const effectiveAccess = await resolveEffectiveAccess(account)

    req.user = {
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
      passwordVersion: currentPasswordVersion,
      mustChangePassword: !!account.mustChangePassword,
      isRootAdmin: !!effectiveAccess.isRootAdmin,
      isActive: !!account.isActive,
    }

    next()
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: 'Invalid or expired token',
    })
  }
}

module.exports = requireAuth