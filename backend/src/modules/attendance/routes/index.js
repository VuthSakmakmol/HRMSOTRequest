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

router.get(
  '/import/sample',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.downloadAttendanceImportSample,
)

router.post(
  '/import',
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

router.get(
  '/records',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.listAttendanceRecords,
)

router.get(
  '/verification/ot/search',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.searchOTRequestsForVerification,
)

router.get(
  '/verification/ot/:otRequestId',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.verifyOTAttendance,
)

module.exports = router