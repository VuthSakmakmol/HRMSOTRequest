// backend/src/modules/attendance/routes/verification.routes.js

const express = require('express')

const attendanceController = require('../controllers/attendance.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.get(
  '/ot/search',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.searchOTRequestsForVerification,
)

router.get(
  '/ot/:otRequestId',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.verifyOTAttendance,
)

module.exports = router