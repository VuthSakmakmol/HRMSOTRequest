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

// Preview only.
// Does not save payable minutes into OTRequest.
router.get(
  '/ot/:otRequestId',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.verifyOTAttendance,
)

// Save verification result.
// This updates OTRequest.approvedEmployees with payment-ready payable minutes.
router.post(
  '/ot/:otRequestId/verify',
  requirePermission('ATTENDANCE_VERIFY'),
  attendanceController.verifyAndSaveOTAttendance,
)

module.exports = router