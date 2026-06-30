// backend/src/modules/attendance/controllers/attendanceScan.controller.js

const { successResponse } = require('../../../shared/utils/apiResponse')
const attendanceScanService = require('../services/attendanceScan.service')
const {
  submitAttendanceScanSchema,
  listAttendanceScanLogsQuerySchema,
  attendanceScanSummaryQuerySchema,
} = require('../validators/attendance.validation')

function parse(schema, data) {
  return schema.parse(data)
}

async function submitAttendanceScan(req, res, next) {
  try {
    const payload = parse(submitAttendanceScanSchema, req.body || {})
    const result = await attendanceScanService.submitScan(payload, req.user)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listAttendanceScanLogs(req, res, next) {
  try {
    const query = parse(listAttendanceScanLogsQuerySchema, req.query || {})
    const result = await attendanceScanService.listScanLogs(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getAttendanceScanSummary(req, res, next) {
  try {
    const query = parse(attendanceScanSummaryQuerySchema, req.query || {})
    const result = await attendanceScanService.getScanSummary(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  submitAttendanceScan,
  listAttendanceScanLogs,
  getAttendanceScanSummary,
}
