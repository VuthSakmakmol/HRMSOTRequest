// backend/src/middlewares/requireAuth.js

const { verifyAccessToken } = require('../shared/utils/jwt')
const AppError = require('../shared/errors/AppError')
const Account = require('../modules/auth/models/Account')
const { resolveEffectiveAccess } = require('../modules/auth/utils/resolveEffectiveAccess')
const { AUTH_EMPLOYEE_POPULATE, buildAuthUser } = require('../modules/auth/utils/buildAuthUser')

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

    const account = await Account.findById(payload.sub)
      .populate(AUTH_EMPLOYEE_POPULATE)
      .lean()

    if (!account || !account.isActive) {
      return next(unauthorizedError())
    }

    const tokenPasswordVersion = Number(payload.passwordVersion || 1)
    const currentPasswordVersion = Number(account.passwordVersion || 1)

    if (tokenPasswordVersion !== currentPasswordVersion) {
      return next(sessionExpiredError())
    }

    const effectiveAccess = await resolveEffectiveAccess(account)

    req.user = await buildAuthUser(
      {
        ...account,
        passwordVersion: currentPasswordVersion,
      },
      { effectiveAccess },
    )

    return next()
  } catch (error) {
    return next(error)
  }
}

module.exports = requireAuth
