// backend/src/middlewares/requirePermission.middleware.js
const { resolveEffectiveAccess } = require('../modules/auth/utils/resolveEffectiveAccess')

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

function requirePermission(requiredCode) {
  const target = normalizeCode(requiredCode)

  return async function permissionGuard(req, res, next) {
    try {
      if (!req.user || !req.user.accountId) {
        return res.status(401).json({
          message: 'Unauthorized',
        })
      }

      const effectiveAccess = await resolveEffectiveAccess(req.user)

      req.user.roleCodes = effectiveAccess.roleCodes
      req.user.effectivePermissionCodes = effectiveAccess.permissionCodes
      req.user.isRootAdmin = effectiveAccess.isRootAdmin

      if (effectiveAccess.isRootAdmin) {
        return next()
      }

      if (effectiveAccess.permissionCodes.includes(target)) {
        return next()
      }

      return res.status(403).json({
        message: 'Forbidden',
      })
    } catch (error) {
      return next(error)
    }
  }
}

module.exports = requirePermission