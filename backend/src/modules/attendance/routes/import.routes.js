// backend/src/modules/attendance/routes/import.routes.js

const express = require('express')
const multer = require('multer')

const attendanceController = require('../controllers/attendance.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const ATTENDANCE_IMPORT_TIMEOUT_MS = 30 * 60 * 1000
const ATTENDANCE_IMPORT_FILE_SIZE_LIMIT = 50 * 1024 * 1024

function useLongAttendanceImportTimeout(req, res, next) {
  req.setTimeout(ATTENDANCE_IMPORT_TIMEOUT_MS)
  res.setTimeout(ATTENDANCE_IMPORT_TIMEOUT_MS)
  next()
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ATTENDANCE_IMPORT_FILE_SIZE_LIMIT,
  },
})

router.get(
  '/import/sample',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.downloadAttendanceImportSample,
)

router.post(
  '/import',
  useLongAttendanceImportTimeout,
  requirePermission('ATTENDANCE_IMPORT'),
  upload.single('file'),
  attendanceController.importAttendanceExcel,
)

router.get(
  '/imports',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.listAttendanceImports,
)

router.get(
  '/imports/:id',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.getAttendanceImportById,
)

module.exports = router