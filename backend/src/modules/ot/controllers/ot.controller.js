// backend/src/modules/ot/controllers/ot.controller.js

const AppError = require('../../../shared/errors/AppError')
const { successResponse } = require('../../../shared/utils/apiResponse')

const otService = require('../services/ot.service')
const otAcknowledgementService = require('../services/otAcknowledgement.service')

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

async function createOTRequest(req, res, next) {
  try {
    const payload = parse(createOTRequestSchema, req.body || {})
    const item = await otService.create(payload, req.user)

    return successResponse(
      res,
      {
        item,
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
    const item = await otService.update(params.id, payload, req.user)

    return successResponse(res, {
      item,
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

    return successResponse(res, result)
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
      item,
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

    return successResponse(res, result)
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

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function decideOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(otApprovalDecisionSchema, req.body || {})
    const item = await otService.decide(params.id, payload, req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

async function requesterConfirmOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(otRequesterConfirmationSchema, req.body || {})
    const item = await otService.requesterConfirm(params.id, payload, req.user)

    return successResponse(res, {
      item,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  createOTRequest,
  updateOTRequest,
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