// backend/src/middlewares/notFound.middleware.js

const AppError = require('../shared/errors/AppError')

function notFound(req, res, next) {
  return next(
    new AppError({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      messageKey: 'common.error.routeNotFound',
      message: 'Route not found',
      params: {
        method: req.method,
        path: req.originalUrl,
      },
    }),
  )
}

module.exports = notFound