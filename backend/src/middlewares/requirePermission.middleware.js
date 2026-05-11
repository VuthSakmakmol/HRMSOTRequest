// backend/src/middlewares/requirePermission.middleware.js

const AppError = require('../shared/errors/AppError')
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

function requirePermission(requiredCode) {
  const target = normalizeCode(requiredCode)

  return async function permissionGuard(req, res, next) {
    try {
      if (!target) {
        return next(
          new AppError({
            statusCode: 500,
            code: 'PERMISSION_MIDDLEWARE_CONFIG_ERROR',
            messageKey: 'access.error.permissionMiddlewareConfigError',
            message: 'Permission middleware misconfigured: missing required permission code.',
          }),
        )
      }

      if (!req.user || !req.user.accountId) {
        return next(
          new AppError({
            statusCode: 401,
            code: 'AUTH_UNAUTHORIZED',
            messageKey: 'auth.error.unauthorized',
            message: 'Unauthorized',
          }),
        )
      }

      const effectiveAccess = await resolveEffectiveAccess(req.user)

      const roleCodes = normalizeCodeList(effectiveAccess.roleCodes)
      const permissionCodes = normalizeCodeList(effectiveAccess.permissionCodes)
      const isRootAdmin = effectiveAccess.isRootAdmin === true

      req.user.roleCodes = roleCodes
      req.user.roles = roleCodes
      req.user.effectivePermissionCodes = permissionCodes
      req.user.isRootAdmin = isRootAdmin

      if (isRootAdmin) {
        return next()
      }

      if (permissionCodes.includes(target)) {
        return next()
      }

      return next(
        new AppError({
          statusCode: 403,
          code: 'MISSING_PERMISSION',
          messageKey: 'access.error.missingPermission',
          message: `Missing required permission: ${target}`,
          params: {
            requiredPermission: target,
            requiredPermissionCode: target,
          },
        }),
      )
    } catch (error) {
      return next(error)
    }
  }
}

module.exports = requirePermission