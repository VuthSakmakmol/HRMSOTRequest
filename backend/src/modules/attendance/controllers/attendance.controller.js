// backend/src/modules/attendance/controllers/attendance.controller.js
const attendanceService = require('../services/attendance.service')
const {
  createAttendanceImportSchema,
  normalizeListAttendanceImportsQuery,
  normalizeListAttendanceRecordsQuery,
  attendanceImportIdParamSchema,
  attendanceVerifyOTParamSchema,
} = require('../validators/attendance.validation')

function parseBody(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    err.issues = result.error.issues
    throw err
  }

  return result.data
}

function parseQuery(normalizer, data) {
  try {
    return normalizer(data)
  } catch (error) {
    if (error?.name === 'ZodError') {
      const err = new Error(error.issues?.[0]?.message || 'Validation error')
      err.status = 400
      err.issues = error.issues
      throw err
    }

    throw error
  }
}

function parseParams(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const err = new Error(result.error.issues[0]?.message || 'Validation error')
    err.status = 400
    err.issues = result.error.issues
    throw err
  }

  return result.data
}

async function importAttendance(req, res, next) {
  try {
    const payload = parseBody(createAttendanceImportSchema, req.body || {})
    const data = await attendanceService.importExcel(req.file, payload, req.user)

    res.status(201).json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listAttendanceImports(req, res, next) {
  try {
    const query = parseQuery(normalizeListAttendanceImportsQuery, req.query || {})
    const data = await attendanceService.listImports(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function getAttendanceImportDetail(req, res, next) {
  try {
    const params = parseParams(attendanceImportIdParamSchema, req.params || {})
    const data = await attendanceService.getImportById(params.id)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function listAttendanceRecords(req, res, next) {
  try {
    const query = parseQuery(normalizeListAttendanceRecordsQuery, req.query || {})
    const data = await attendanceService.listRecords(query)

    res.json({
      ok: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function verifyAttendanceAgainstOT(req, res, next) {
  try {
    const params = parseParams(attendanceVerifyOTParamSchema, req.params || {})
    const data = await attendanceService.verifyOTRequest(params.id)

    res.json({
      ok: true,
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


module.exports = {
  importAttendance,
  listAttendanceImports,
  getAttendanceImportDetail,
  listAttendanceRecords,
  verifyAttendanceAgainstOT,
  downloadAttendanceImportSample,
}