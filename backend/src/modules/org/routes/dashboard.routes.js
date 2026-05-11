// backend/src/modules/org/routes/dashboard.routes.js

const express = require('express')

const dashboardController = require('../controllers/dashboard.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/summary',
  requirePermission('EMPLOYEE_VIEW'),
  dashboardController.getOrgDashboardSummary,
)

router.get(
  '/departments/summary',
  requirePermission('DEPARTMENT_VIEW'),
  dashboardController.getDepartmentDashboardSummary,
)

router.get(
  '/positions/summary',
  requirePermission('POSITION_VIEW'),
  dashboardController.getPositionDashboardSummary,
)

router.get(
  '/lines/summary',
  requirePermission('LINE_VIEW'),
  dashboardController.getLineDashboardSummary,
)

router.get(
  '/employees/summary',
  requirePermission('EMPLOYEE_VIEW'),
  dashboardController.getEmployeeDashboardSummary,
)

module.exports = router