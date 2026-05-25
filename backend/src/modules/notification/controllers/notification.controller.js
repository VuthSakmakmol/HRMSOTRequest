// backend/src/modules/notification/controllers/notification.controller.js

const { z } = require('zod')

const AppError = require('../../../shared/errors/AppError')
const { successResponse } = require('../../../shared/utils/apiResponse')

const notificationService = require('../services/notification.service')

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(100).default(20),

  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === true) return true

      const text = String(value ?? '').trim().toLowerCase()

      return text === 'true' || text === '1' || text === 'yes'
    }),
})

const idParamSchema = z.object({
  id: z.string().trim().min(1, 'notification.validation.idRequired'),
})

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (result.success) {
    return result.data
  }

  const firstIssue = result.error.issues?.[0]
  const messageKey = firstIssue?.message || 'common.validation.invalidRequest'

  const error = new AppError({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    messageKey,
    message: messageKey,
    field: firstIssue?.path?.length ? firstIssue.path.join('.') : null,
    params: {
      issues: result.error.issues.map((issue) => ({
        path: issue.path,
        messageKey: issue.message,
        code: issue.code,
      })),
    },
  })

  error.issues = result.error.issues.map((issue) => ({
    path: issue.path,
    messageKey: issue.message,
    code: issue.code,
  }))

  throw error
}

function notFoundError() {
  return new AppError({
    statusCode: 404,
    code: 'NOTIFICATION_NOT_FOUND',
    messageKey: 'notification.error.notFound',
    message: 'Notification not found',
    field: 'id',
  })
}

function currentNotificationUser(req) {
  return {
    accountId: req.user?.accountId || req.user?.id || null,
    employeeId: req.user?.employeeId || null,
    loginId: req.user?.loginId || '',
    displayName: req.user?.displayName || '',
  }
}

async function listMyNotifications(req, res, next) {
  try {
    const query = parse(listQuerySchema, req.query || {})

    const result = await notificationService.listMyNotifications({
      ...currentNotificationUser(req),
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly === true,
    })

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function markNotificationRead(req, res, next) {
  try {
    const params = parse(idParamSchema, req.params || {})

    const item = await notificationService.markNotificationRead(
      params.id,
      currentNotificationUser(req),
    )

    if (!item) {
      throw notFoundError()
    }

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    const result = await notificationService.markAllNotificationsRead(
      currentNotificationUser(req),
    )

    return successResponse(res, {
      item: result,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
}