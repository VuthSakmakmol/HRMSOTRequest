// backend/src/modules/attendance/routes/dashboard.routes.js
// backend/src/modules/attendance/routes/dashboard.routes.js

const express = require('express')

const dashboardController = require('../controllers/dashboard.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/summary',
  requirePermission('ATTENDANCE_VIEW'),
  dashboardController.getAttendanceDashboardSummary,
)

module.exports = router