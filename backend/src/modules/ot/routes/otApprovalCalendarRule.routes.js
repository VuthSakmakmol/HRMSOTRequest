// backend/src/modules/ot/routes/otApprovalCalendarRule.routes.js

const express = require('express')

const requirePermission = require('../../../middlewares/requirePermission.middleware')
const controller = require('../controllers/otApprovalCalendarRule.controller')

const router = express.Router()

router.get(
  '/employees',
  requirePermission('OT_APPROVAL_RULE_VIEW'),
  controller.listEmployeeOptions,
)

router.get(
  '/',
  requirePermission('OT_APPROVAL_RULE_VIEW'),
  controller.list,
)

router.put(
  '/:employeeId',
  requirePermission('OT_APPROVAL_RULE_UPDATE'),
  controller.upsert,
)

router.delete(
  '/:employeeId',
  requirePermission('OT_APPROVAL_RULE_UPDATE'),
  controller.reset,
)

module.exports = router
