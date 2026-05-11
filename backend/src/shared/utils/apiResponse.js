// backend/src/shared/utils/apiResponse.js

function successResponse(res, payload = {}, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    ...payload,
  })
}

function errorResponse(res, error = {}, statusCode = 500) {
  const safeStatusCode = Number(statusCode || error.statusCode || 500)

  return res.status(safeStatusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      messageKey: error.messageKey || 'common.error.internalServerError',
      message: error.message || 'Internal server error',
      field: error.field || null,
      params: error.params || {},
      issues: error.issues || undefined,
    },
  })
}

module.exports = {
  successResponse,
  errorResponse,
}