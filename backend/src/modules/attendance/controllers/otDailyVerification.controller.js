// backend/src/modules/attendance/controllers/otDailyVerification.controller.js

const { successResponse } = require('../../../shared/utils/apiResponse')
const service = require('../services/otDailyVerification.service')
const {
  dailyOTVerificationQuerySchema,
  createVerificationAttendanceSchema,
  createVerificationOTRequestSchema,
  recoverVerificationAttendanceSchema,
  verificationHistoryQuerySchema,
} = require('../validators/attendance.validation')

function parse(schema, data) {
  return schema.parse(data || {})
}

async function listDaily(req, res, next) {
  try {
    const query = parse(dailyOTVerificationQuerySchema, req.query)
    return successResponse(res, await service.listDailyVerification(query))
  } catch (error) {
    return next(error)
  }
}

async function exportDaily(req, res, next) {
  try {
    const query = parse(dailyOTVerificationQuerySchema, req.query)
    const result = await service.exportDailyVerification(query)

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName.replace(/"/g, '')}"`,
    )
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function createAttendance(req, res, next) {
  try {
    const payload = parse(createVerificationAttendanceSchema, req.body)
    return successResponse(res, await service.createAttendanceFromOTRequest(payload, req.user))
  } catch (error) {
    return next(error)
  }
}

async function createOTRequest(req, res, next) {
  try {
    const payload = parse(createVerificationOTRequestSchema, req.body)
    return successResponse(res, await service.createOTRequestFromAttendance(payload, req.user))
  } catch (error) {
    return next(error)
  }
}

async function recoverAttendance(req, res, next) {
  try {
    const payload = parse(recoverVerificationAttendanceSchema, req.body)
    return successResponse(res, await service.recoverVerificationAttendance(payload, req.user))
  } catch (error) {
    return next(error)
  }
}

async function history(req, res, next) {
  try {
    const query = parse(verificationHistoryQuerySchema, req.query)
    return successResponse(res, await service.listHistory(query))
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  listDaily,
  exportDaily,
  createAttendance,
  createOTRequest,
  recoverAttendance,
  history,
}
