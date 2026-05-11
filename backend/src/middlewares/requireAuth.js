// backend/src/middlewares/requireAuth.js

const { verifyAccessToken } = require('../shared/utils/jwt')
const AppError = require('../shared/errors/AppError')
const Account = require('../modules/auth/models/Account')
const { resolveEffectiveAccess } = require('../modules/auth/utils/resolveEffectiveAccess')

function unauthorizedError(message = 'Unauthorized') {
  return new AppError({
    statusCode: 401,
    code: 'AUTH_UNAUTHORIZED',
    messageKey: 'auth.error.unauthorized',
    message,
  })
}

function sessionExpiredError() {
  return new AppError({
    statusCode: 401,
    code: 'AUTH_SESSION_EXPIRED',
    messageKey: 'auth.error.sessionExpired',
    message: 'Session expired. Please login again.',
  })
}

function invalidTokenError() {
  return new AppError({
    statusCode: 401,
    code: 'AUTH_INVALID_TOKEN',
    messageKey: 'auth.error.invalidToken',
    message: 'Invalid or expired token',
  })
}

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || ''
    const [type, token] = authHeader.split(' ')

    if (type !== 'Bearer' || !token) {
      return next(unauthorizedError())
    }

    let payload
    try {
      payload = verifyAccessToken(token)
    } catch (_) {
      return next(invalidTokenError())
    }

    const account = await Account.findById(payload.sub).lean()

    if (!account || !account.isActive) {
      return next(unauthorizedError())
    }

    const tokenPasswordVersion = Number(payload.passwordVersion || 1)
    const currentPasswordVersion = Number(account.passwordVersion || 1)

    if (tokenPasswordVersion !== currentPasswordVersion) {
      return next(sessionExpiredError())
    }

    const effectiveAccess = await resolveEffectiveAccess(account)

    req.user = {
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
      passwordVersion: currentPasswordVersion,
      mustChangePassword: !!account.mustChangePassword,
      isRootAdmin: !!effectiveAccess.isRootAdmin,
      isActive: !!account.isActive,
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

module.exports = requireAuth