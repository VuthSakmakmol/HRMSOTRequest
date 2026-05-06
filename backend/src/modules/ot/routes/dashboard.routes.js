// backend/src/modules/ot/routes/dashboard.routes.js
// backend/src/modules/ot/routes/dashboard.routes.js

const express = require('express')

const dashboardController = require('../controllers/dashboard.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/summary',
  requirePermission('OT_REQUEST_VIEW'),
  dashboardController.getOTDashboardSummary,
)

module.exports = router