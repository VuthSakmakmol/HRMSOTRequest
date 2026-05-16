// backend/src/shared/errors/AppError.js

class AppError extends Error {
  constructor({
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    messageKey = 'common.error.internalServerError',
    message = 'Internal server error',
    field = null,
    params = {},
    issues = undefined,
    errors = undefined,
  } = {}) {
    super(message)

    const safeParams = params && typeof params === 'object' ? params : {}

    this.name = 'AppError'
    this.statusCode = Number(statusCode || 500)
    this.status = this.statusCode

    this.code = String(code || 'INTERNAL_SERVER_ERROR').trim().toUpperCase()
    this.messageKey = String(messageKey || 'common.error.internalServerError').trim()
    this.field = field || null
    this.params = safeParams

    this.issues = Array.isArray(issues) ? issues : undefined
    this.errors = Array.isArray(errors)
      ? errors
      : Array.isArray(safeParams.errors)
        ? safeParams.errors
        : undefined

    this.isOperational = true

    Error.captureStackTrace?.(this, this.constructor)
  }
}

module.exports = AppError