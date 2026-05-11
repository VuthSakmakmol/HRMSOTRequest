// backend/src/modules/attendance/controllers/attendance.controller.js

const attendanceService = require('../services/attendance.service')
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
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues?.[0]?.message || 'Validation error')
    err.status = 400
    err.statusCode = 400
    throw err
  }

  return result.data
}

async function importAttendanceExcel(req, res, next) {
  try {
    const payload = parse(createAttendanceImportSchema, req.body || {})
    const data = await attendanceService.importExcel(req.file, payload, req.user)

    res.status(201).json({
      success: true,
      message: 'Attendance imported successfully',
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function downloadAttendanceImportSample(req, res, next) {
  try {
    const result = await attendanceService.downloadImportSample()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    )

    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function listAttendanceImports(req, res, next) {
  try {
    const query = parse(listAttendanceImportsQuerySchema, req.query || {})
    const data = await attendanceService.listImports(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getAttendanceImportById(req, res, next) {
  try {
    const params = parse(attendanceImportIdParamSchema, req.params || {})
    const data = await attendanceService.getImportById(params.id)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listAttendanceRecords(req, res, next) {
  try {
    const query = parse(listAttendanceRecordsQuerySchema, req.query || {})
    const data = await attendanceService.listRecords(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getAttendanceRecordById(req, res, next) {
  try {
    const params = parse(attendanceRecordIdParamSchema, req.params || {})
    const data = await attendanceService.getRecordById(params.id)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function searchOTRequestsForVerification(req, res, next) {
  try {
    const query = parse(searchOTVerificationQuerySchema, req.query || {})
    const data = await attendanceService.searchOTRequestsForVerification(query)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function verifyOTAttendance(req, res, next) {
  try {
    const params = parse(verifyOTAttendanceParamSchema, req.params || {})
    const data = await attendanceService.verifyOTRequest(params.otRequestId)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
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