// backend/src/modules/ot/controllers/ot.controller.js
const mongoose = require('mongoose')
const otService = require('../services/ot.service')
const {
  createOTRequestSchema,
  updateOTRequestSchema,
  listOTRequestsQuerySchema,
  listOTApprovalInboxQuerySchema,
  otRequestIdParamSchema,
  otApprovalDecisionSchema,
  otRequesterConfirmationSchema,
} = require('../validators/ot.validation')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    throw err
  }

  return result.data
}

function parseObjectIdParam(value, label = 'id') {
  const id = String(value || '').trim()

  if (!mongoose.isValidObjectId(id)) {
    const err = new Error(`Invalid ${label}`)
    err.status = 400
    throw err
  }

  return id
}

async function createOTRequest(req, res, next) {
  try {
    const payload = parse(createOTRequestSchema, req.body || {})

    const data = await otService.create(payload, req.user)

    res.status(201).json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function updateOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(updateOTRequestSchema, req.body || {})

    const data = await otService.update(params.id, payload, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listOTRequests(req, res, next) {
  try {
    const query = parse(listOTRequestsQuerySchema, req.query || {})
    const data = await otService.list(query, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function exportOTRequestsExcel(req, res, next) {
  try {
    const query = parse(listOTRequestsQuerySchema, req.query || {})
    const file = await otService.exportRequestsExcel(query)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`
    )

    res.send(file.buffer)
  } catch (error) {
    next(error)
  }
}

async function getOTRequestDetail(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const data = await otService.getById(params.id, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getAllowedApproverChain(req, res, next) {
  try {
    const employeeId = parseObjectIdParam(req.params.employeeId, 'employeeId')
    const data = await otService.getAllowedApproverChain(employeeId)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listMyApprovalInbox(req, res, next) {
  try {
    const query = parse(listOTApprovalInboxQuerySchema, req.query || {})
    const data = await otService.listApprovalInbox(query, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function exportOTApprovalInboxExcel(req, res, next) {
  try {
    const query = parse(listOTApprovalInboxQuerySchema, req.query || {})
    const file = await otService.exportApprovalInboxExcel(query, req.user)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`
    )

    res.send(file.buffer)
  } catch (error) {
    next(error)
  }
}

async function decideOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(otApprovalDecisionSchema, req.body || {})

    const data = await otService.decide(params.id, payload, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function requesterConfirmOTRequest(req, res, next) {
  try {
    const params = parse(otRequestIdParamSchema, req.params || {})
    const payload = parse(otRequesterConfirmationSchema, req.body || {})

    const data = await otService.requesterConfirm(params.id, payload, req.user)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createOTRequest,
  updateOTRequest,
  listOTRequests,
  exportOTRequestsExcel,
  getOTRequestDetail,
  getAllowedApproverChain,
  listMyApprovalInbox,
  exportOTApprovalInboxExcel,
  decideOTRequest,
  requesterConfirmOTRequest,
}