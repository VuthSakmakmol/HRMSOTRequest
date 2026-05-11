// backend/src/modules/attendance/routes/dashboard.routes.js

const express = require('express')

const dashboardController = require('../controllers/dashboard.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.get(
  '/summary',
  requirePermission('ATTENDANCE_VIEW'),
  dashboardController.getAttendanceDashboardSummary,
)

module.exports = router