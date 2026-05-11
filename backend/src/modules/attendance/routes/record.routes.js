// backend/src/modules/attendance/routes/record.routes.js

const express = require('express')

const attendanceController = require('../controllers/attendance.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.get(
  '/',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.listAttendanceRecords,
)

router.get(
  '/:id',
  requirePermission('ATTENDANCE_VIEW'),
  attendanceController.getAttendanceRecordById,
)

module.exports = router