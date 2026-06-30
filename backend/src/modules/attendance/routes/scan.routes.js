// backend/src/modules/attendance/routes/scan.routes.js

const express = require('express')

const attendanceScanController = require('../controllers/attendanceScan.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.post(
  '/',
  requirePermission('ATTENDANCE_SCAN_USE'),
  attendanceScanController.submitAttendanceScan,
)

router.get(
  '/summary',
  requirePermission('ATTENDANCE_SCAN_LOG_VIEW'),
  attendanceScanController.getAttendanceScanSummary,
)

router.get(
  '/logs',
  requirePermission('ATTENDANCE_SCAN_LOG_VIEW'),
  attendanceScanController.listAttendanceScanLogs,
)

module.exports = router
