// backend/src/modules/attendance/routes/index.js
const express = require('express')
const multer = require('multer')

const attendanceController = require('../controllers/attendance.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.use(requireAuth)

router.post(
  '/import',
  requirePermission('ATTENDANCE_IMPORT'),
  upload.single('file'),
  attendanceController.importAttendance
)

router.get(
  '/imports',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.listAttendanceImports
)

router.get(
  '/imports/:id',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.getAttendanceImportDetail
)

router.get(
  '/records',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.listAttendanceRecords
)

router.get(
  '/verification/ot/:id',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.verifyAttendanceAgainstOT
)

router.get(
  '/import/sample',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.downloadAttendanceImportSample
)

module.exports = router