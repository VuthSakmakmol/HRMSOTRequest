// backend/src/middlewares/requirePermission.middleware.js

const { resolveEffectiveAccess } = require('../modules/auth/utils/resolveEffectiveAccess')

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeCodeList(values) {
  if (!Array.isArray(values)) return []

  return values
    .map((item) => normalizeCode(item))
    .filter(Boolean)
}

function buildMissingPermissionMessage(permissionCode) {
  return `Missing required permission: ${permissionCode}`
}

function requirePermission(requiredCode) {
  const target = normalizeCode(requiredCode)

  return async function permissionGuard(req, res, next) {
    try {
      if (!target) {
        return res.status(500).json({
          ok: false,
          message: 'Permission middleware misconfigured: missing required permission code.',
          error: 'PERMISSION_MIDDLEWARE_CONFIG_ERROR',
          statusCode: 500,
        })
      }

      if (!req.user || !req.user.accountId) {
        return res.status(401).json({
          ok: false,
          message: 'Unauthorized',
          error: 'UNAUTHORIZED',
          statusCode: 401,
        })
      }

      const effectiveAccess = await resolveEffectiveAccess(req.user)

      const roleCodes = normalizeCodeList(effectiveAccess.roleCodes)
      const permissionCodes = normalizeCodeList(effectiveAccess.permissionCodes)
      const isRootAdmin = effectiveAccess.isRootAdmin === true

      req.user.roleCodes = roleCodes
      req.user.effectivePermissionCodes = permissionCodes
      req.user.isRootAdmin = isRootAdmin

      if (isRootAdmin) {
        return next()
      }

      if (permissionCodes.includes(target)) {
        return next()
      }

      return res.status(403).json({
        ok: false,
        message: buildMissingPermissionMessage(target),
        error: 'MISSING_PERMISSION',
        requiredPermission: target,
        requiredPermissionCode: target,
        statusCode: 403,
      })
    } catch (error) {
      return next(error)
    }
  }
}

module.exports = requirePermission