// backend/src/middlewares/errorHandler.middleware.js

const AppError = require('../shared/errors/AppError')
const { errorResponse } = require('../shared/utils/apiResponse')

function normalizeZodIssues(error) {
  if (!Array.isArray(error?.issues)) return undefined

  return error.issues.map((issue) => {
    const field = Array.isArray(issue.path) ? issue.path.join('.') : ''

    return {
      field,
      code: issue.code || 'VALIDATION_ERROR',
      messageKey: `validation.${field || 'field'}.invalid`,
      message: issue.message || 'Invalid value',
      params: {},
    }
  })
}

function errorHandler(error, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production'

  if (!isProduction) {
    console.error('[error]', error)
  }

  if (error instanceof AppError) {
    return errorResponse(res, error, error.statusCode)
  }

  if (error?.name === 'ZodError') {
    return errorResponse(
      res,
      {
        code: 'VALIDATION_ERROR',
        messageKey: 'common.error.validationError',
        message: 'Validation error',
        issues: normalizeZodIssues(error),
      },
      400,
    )
  }

  if (error?.name === 'CastError') {
    return errorResponse(
      res,
      {
        code: 'INVALID_ID',
        messageKey: 'common.error.invalidId',
        message: 'Invalid id',
        field: error.path || null,
        params: {
          value: error.value,
        },
      },
      400,
    )
  }

  if (error?.code === 11000) {
    return errorResponse(
      res,
      {
        code: 'DUPLICATE_RECORD',
        messageKey: 'common.error.duplicateRecord',
        message: 'Duplicate record',
        params: {
          keyPattern: error.keyPattern || {},
          keyValue: error.keyValue || {},
        },
      },
      409,
    )
  }

  const statusCode = Number(error?.statusCode || error?.status || 500)

  return errorResponse(
    res,
    {
      code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
      messageKey:
        statusCode === 404
          ? 'common.error.notFound'
          : 'common.error.internalServerError',
      message:
        statusCode === 500 && isProduction
          ? 'Internal server error'
          : error?.message || 'Internal server error',
      issues: error?.issues || undefined,
    },
    statusCode,
  )
}

module.exports = errorHandler