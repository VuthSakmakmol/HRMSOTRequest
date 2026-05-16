// backend/src/shared/utils/apiResponse.js

function successResponse(res, payload = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...payload,
  })
}

function errorResponse(res, error = {}, statusCode = 500) {
  const safeStatusCode = Number(statusCode || error.statusCode || 500)

  const code = error.code || 'INTERNAL_SERVER_ERROR'
  const messageKey = error.messageKey || 'common.error.internalServerError'
  const message = error.message || 'Internal server error'
  const field = error.field || null
  const params = error.params && typeof error.params === 'object' ? error.params : {}
  const issues = Array.isArray(error.issues) ? error.issues : undefined
  const errors = Array.isArray(error.errors)
    ? error.errors
    : Array.isArray(params.errors)
      ? params.errors
      : undefined

  return res.status(safeStatusCode).json({
    success: false,

    // Top-level fields for frontend helpers
    code,
    messageKey,
    message,
    field,
    params,
    issues,
    errors,

    // Keep old nested format for compatibility
    error: {
      code,
      messageKey,
      message,
      field,
      params,
      issues,
      errors,
    },
  })
}

module.exports = {
  successResponse,
  errorResponse,
}