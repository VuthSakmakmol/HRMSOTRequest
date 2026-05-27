// backend/src/modules/ot/controllers/ot.controller.js

const AppError = require('../../../shared/errors/AppError')
const { successResponse } = require('../../../shared/utils/apiResponse')

const otService = require('../services/ot.service')
const otAcknowledgementService = require('../services/otAcknowledgement.service')
const { presentOTRequest } = require('../services/otRequestPresenter.service')

const {
  buildTrustedCreatePayload,
  buildTrustedUpdatePayload,
} = require('../services/otRequestWriteGuard.service')

const {
  normalizeSavedOTRequestTiming,
} = require('../services/otRequestSavedTiming.service')

const {
  notifyOTCreated,
  notifyOTAfterDecision,
  notifyOTAfterRequesterConfirmation,
} = require('../services/otNotification.service')

const {
  createOTRequestSchema,
  updateOTRequestSchema,
  listOTRequestsQuerySchema,
  listOTApprovalInboxQuerySchema,
  unavailableOTEmployeesQuerySchema,
  otRequestIdParamSchema,
  allowedApproverChainParamSchema,
  shiftOptionsByShiftParamSchema,
  shiftOptionsByShiftQuerySchema,
  otApprovalDecisionSchema,
  otRequesterConfirmationSchema,
} = require('../validators/ot.validation')

const {
  emitOTChanged,
} = require('../services/otRealtime.service')

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

function setExcelHeaders(res, filename) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
}

function presentItem(item, authUser) {
  if (!item || typeof item !== 'object') return item

  return {
    ...item,
    ...presentOTRequest(item, authUser),
  }
}

function presentListResult(result, authUser) {
  if (!result || typeof result !== 'object') return result

  if (!Array.isArray(result.items)) {
    return result
  }

  return {
    ...result,
    items: result.items.map((item) => presentItem(item, authUser)),
  }
}

async function safeNotify(task) {
  try {
    await task()
  } catch (error) {
    console.error('[OT_NOTIFICATION_FAILED]', error)
  }
}

async function safeRealtime(task) {
  try {
    await task()
  } catch (error) {
    console.error('[OT_REALTIME_FAILED]', error)
  }
}

async function createOTRequest(req, res, next) {
  try {
    const payload = parse(createOTRequestSchema, req.body || {})
    const trustedPayload = await buildTrustedCreatePayload(payload)

    const createdItem = await otService.create(trustedPayload, req.user)
    const item = await normalizeSavedOTRequestTiming(createdItem)

    await safeNotify(() => notifyOTCreated(item, req.user))
    await safeRealtime(() => emitOTChanged(item, req.user, 'CREATED'))

    return successResponse(
      res,
      {
        item: presentItem(item, req.user),
      },
      201,
    )
  } catch (error) {
    return next(error)
  }
}

async function updateOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(updateOTRequestSchema, req.body || {})
    const trustedPayload = await buildTrustedUpdatePayload(params.id, payload)

    const updatedItem = await otService.update(params.id, trustedPayload, req.user)
    const item = await normalizeSavedOTRequestTiming(updatedItem)
    await safeRealtime(() => emitOTChanged(item, req.user, 'UPDATED'))

    return successResponse(res, {
      item: presentItem(item, req.user),
    })
  } catch (error) {
    return next(error)
  }
}


async function cancelOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})

    const cancelledItem = await otService.cancel(params.id, req.user)
    const item = await normalizeSavedOTRequestTiming(cancelledItem)

    await safeRealtime(() => emitOTChanged(item, req.user, 'CANCELLED'))

    return successResponse(res, {
      item: presentItem(item, req.user),
    })
  } catch (error) {
    return next(error)
  }
}

async function listUnavailableOTEmployees(req, res, next) {
  try {
    const query = parse(unavailableOTEmployeesQuerySchema, req.query || {})
    const result = await otService.listUnavailableEmployeesForDate(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listOTRequests(req, res, next) {
  try {
    const query = parse(listOTRequestsQuerySchema, req.query || {})
    const result = await otService.list(query, req.user)

    return successResponse(res, presentListResult(result, req.user))
  } catch (error) {
    return next(error)
  }
}

async function exportOTRequestsExcel(req, res, next) {
  try {
    const query = parse(listOTRequestsQuerySchema, req.query || {})
    const file = await otService.exportRequestsExcel(query, req.user)

    setExcelHeaders(res, file.filename)

    return res.send(file.buffer)
  } catch (error) {
    return next(error)
  }
}

async function getOTRequestDetail(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const item = await otService.getById(params.id, req.user)

    return successResponse(res, {
      item: presentItem(item, req.user),
    })
  } catch (error) {
    return next(error)
  }
}

async function getAllowedApproverChain(req, res, next) {
  try {
    const params = parse(allowedApproverChainParamSchema, req.params || {})
    const result = await otService.getAllowedApproverChain(params.employeeId)

    return successResponse(res, {
      items: result,
      meta: {
        count: Array.isArray(result) ? result.length : 0,
      },
    })
  } catch (error) {
    return next(error)
  }
}

async function getShiftOTOptionsByShift(req, res, next) {
  try {
    const params = parse(shiftOptionsByShiftParamSchema, req.params || {})
    const query = parse(shiftOptionsByShiftQuerySchema, req.query || {})

    const result = await otService.getShiftOTOptionsByShift(params.shiftId, query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listMyApprovalInbox(req, res, next) {
  try {
    const query = parse(listOTApprovalInboxQuerySchema, req.query || {})
    const result = await otService.listApprovalInbox(query, req.user)

    return successResponse(res, presentListResult(result, req.user))
  } catch (error) {
    return next(error)
  }
}

async function exportOTApprovalInboxExcel(req, res, next) {
  try {
    const query = parse(listOTApprovalInboxQuerySchema, req.query || {})
    const file = await otService.exportApprovalInboxExcel(query, req.user)

    setExcelHeaders(res, file.filename)

    return res.send(file.buffer)
  } catch (error) {
    return next(error)
  }
}

async function listMyAcknowledgementInbox(req, res, next) {
  try {
    const query = parse(listOTApprovalInboxQuerySchema, req.query || {})
    const result = await otAcknowledgementService.list(query, req.user)

    return successResponse(res, presentListResult(result, req.user))
  } catch (error) {
    return next(error)
  }
}

async function decideOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(otApprovalDecisionSchema, req.body || {})

    const decidedItem = await otService.decide(params.id, payload, req.user)
    const item = await normalizeSavedOTRequestTiming(decidedItem)

    await safeNotify(() => notifyOTAfterDecision(item, req.user))
    await safeRealtime(() => emitOTChanged(item, req.user, 'DECIDED'))

    return successResponse(res, {
      item: presentItem(item, req.user),
    })
  } catch (error) {
    return next(error)
  }
}

async function requesterConfirmOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(otRequesterConfirmationSchema, req.body || {})

    const confirmedItem = await otService.requesterConfirm(params.id, payload, req.user)
    const item = await normalizeSavedOTRequestTiming(confirmedItem)

    await safeNotify(() => notifyOTAfterRequesterConfirmation(item, req.user))
    await safeRealtime(() => emitOTChanged(item, req.user, 'REQUESTER_CONFIRMED'))

    return successResponse(res, {
      item: presentItem(item, req.user),
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  createOTRequest,
  updateOTRequest,
  cancelOTRequest,
  listUnavailableOTEmployees,
  listOTRequests,
  exportOTRequestsExcel,
  getOTRequestDetail,
  getAllowedApproverChain,
  getShiftOTOptionsByShift,
  listMyApprovalInbox,
  exportOTApprovalInboxExcel,
  listMyAcknowledgementInbox,
  decideOTRequest,
  requesterConfirmOTRequest,
}