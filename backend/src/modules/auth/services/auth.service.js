// backend/src/modules/auth/services/auth.service.js

const Account = require('../models/Account')
const AppError = require('../../../shared/errors/AppError')
const { signAccessToken } = require('../../../shared/utils/jwt')
const { resolveEffectiveAccess } = require('../utils/resolveEffectiveAccess')
const { AUTH_EMPLOYEE_POPULATE, buildAuthUser } = require('../utils/buildAuthUser')

function invalidCredentialsError() {
  return new AppError({
    statusCode: 401,
    code: 'AUTH_INVALID_CREDENTIALS',
    messageKey: 'auth.error.invalidCredentials',
    message: 'Invalid login credentials',
  })
}

async function login({ loginId, password }) {
  const normalizedLoginId = String(loginId || '').trim().toLowerCase()

  const account = await Account.findOne({
    loginId: normalizedLoginId,
    isActive: true,
  }).select('+passwordHash')

  if (!account) {
    throw invalidCredentialsError()
  }

  const passwordOk = await account.comparePassword(password)

  if (!passwordOk) {
    throw invalidCredentialsError()
  }

  await account.populate(AUTH_EMPLOYEE_POPULATE)

  const effectiveAccess = await resolveEffectiveAccess(account)

  const token = signAccessToken({
    sub: String(account._id),
    loginId: account.loginId,
    passwordVersion: Number(account.passwordVersion || 1),
  })

  return {
    token,
    user: await buildAuthUser(account, { effectiveAccess }),
  }
}

module.exports = {
  login,
}
