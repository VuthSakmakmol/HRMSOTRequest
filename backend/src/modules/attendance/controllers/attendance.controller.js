// backend/src/modules/attendance/controllers/attendance.controller.js
const mongoose = require('mongoose')

const attendanceService = require('../services/attendance.service')
const {
  createAttendanceImportSchema,
  listAttendanceImportsQuerySchema,
  listAttendanceRecordsQuerySchema,
  attendanceImportIdParamSchema,
  attendanceRecordIdParamSchema,
  verifyOTAttendanceParamSchema,
} = require('../validators/attendance.validation')

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

    const recordId = parseObjectIdParam(params.id, 'attendance record id')

    const data = await attendanceService.getRecordById
      ? await attendanceService.getRecordById(recordId)
      : null

    if (!data) {
      const err = new Error('Attendance record detail endpoint is not implemented yet')
      err.status = 501
      throw err
    }

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
  verifyOTAttendance,
}