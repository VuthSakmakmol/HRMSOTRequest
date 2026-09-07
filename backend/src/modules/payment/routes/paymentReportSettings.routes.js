const express = require('express')

const requirePermission = require('../../../middlewares/requirePermission.middleware')
const controller = require('../controllers/paymentReportSettings.controller')

const router = express.Router()

router.get(
  '/',
  requirePermission('PAYMENT_REPORT_SETTING_VIEW'),
  controller.getSettings,
)

router.post(
  '/positions',
  requirePermission('PAYMENT_REPORT_SETTING_CREATE'),
  controller.createPosition,
)

router.patch(
  '/positions/:positionId',
  requirePermission('PAYMENT_REPORT_SETTING_UPDATE'),
  controller.updatePosition,
)

router.delete(
  '/positions/:positionId',
  requirePermission('PAYMENT_REPORT_SETTING_DELETE'),
  controller.deletePosition,
)

module.exports = router
