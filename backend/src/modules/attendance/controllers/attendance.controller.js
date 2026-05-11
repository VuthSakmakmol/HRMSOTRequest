// backend/src/modules/attendance/controllers/attendance.controller.js

const attendanceService = require('../services/attendance.service')
const { successResponse } = require('../../../shared/utils/apiResponse')

const {
  createAttendanceImportSchema,
  listAttendanceImportsQuerySchema,
  listAttendanceRecordsQuerySchema,
  attendanceImportIdParamSchema,
  attendanceRecordIdParamSchema,
  searchOTVerificationQuerySchema,
  verifyOTAttendanceParamSchema,
} = require('../validators/attendance.validation')

function parse(schema, data) {
  return schema.parse(data)
}

function setExcelHeaders(res, filename) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
}

async function importAttendanceExcel(req, res, next) {
  try {
    const payload = parse(createAttendanceImportSchema, req.body || {})
    const result = await attendanceService.importExcel(req.file, payload, req.user)

    return successResponse(res, result, 201)
  } catch (error) {
    return next(error)
  }
}

async function downloadAttendanceImportSample(req, res, next) {
  try {
    const result = await attendanceService.downloadImportSample()

    setExcelHeaders(res, result.filename)

    return res.send(result.buffer)
  } catch (error) {
    return next(error)
  }
}

async function listAttendanceImports(req, res, next) {
  try {
    const query = parse(listAttendanceImportsQuerySchema, req.query || {})
    const result = await attendanceService.listImports(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getAttendanceImportById(req, res, next) {
  try {
    const params = parse(attendanceImportIdParamSchema, req.params || {})
    const result = await attendanceService.getImportById(params.id)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function listAttendanceRecords(req, res, next) {
  try {
    const query = parse(listAttendanceRecordsQuerySchema, req.query || {})
    const result = await attendanceService.listRecords(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function getAttendanceRecordById(req, res, next) {
  try {
    const params = parse(attendanceRecordIdParamSchema, req.params || {})
    const result = await attendanceService.getRecordById(params.id)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function searchOTRequestsForVerification(req, res, next) {
  try {
    const query = parse(searchOTVerificationQuerySchema, req.query || {})
    const result = await attendanceService.searchOTRequestsForVerification(query)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

async function verifyOTAttendance(req, res, next) {
  try {
    const params = parse(verifyOTAttendanceParamSchema, req.params || {})
    const result = await attendanceService.verifyOTRequest(params.otRequestId)

    return successResponse(res, result)
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  importAttendanceExcel,
  downloadAttendanceImportSample,
  listAttendanceImports,
  getAttendanceImportById,
  listAttendanceRecords,
  getAttendanceRecordById,
  searchOTRequestsForVerification,
  verifyOTAttendance,
}