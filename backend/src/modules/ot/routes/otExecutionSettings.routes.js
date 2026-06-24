// backend/src/modules/ot/routes/otExecutionSettings.routes.js

const express = require('express')

const requirePermission = require('../../../middlewares/requirePermission.middleware')
const controller = require('../controllers/otExecutionSettings.controller')

const router = express.Router()

// The request access state is deliberately available to every authenticated user.
// It contains no administrative fields and lets the OT form explain why it is disabled.
router.get('/request-access', controller.getOTRequestAccess)

// Payment processors need to know the active calculation rule, even if they are not
// allowed to change execution controls.
router.get(
  '/payment-rule',
  requirePermission('PAYMENT_PROCESS'),
  controller.getPaymentApprovalRule,
)

router.get(
  '/',
  requirePermission('OT_EXECUTION_VIEW'),
  controller.getOTExecutionSettings,
)

router.patch(
  '/',
  requirePermission('OT_EXECUTION_UPDATE'),
  controller.updateOTExecutionSettings,
)

module.exports = router
