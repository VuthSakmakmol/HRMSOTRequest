// backend/src/modules/ot/routes/shiftOtOption.routes.js
const express = require('express')

const shiftOtOptionController = require('../controllers/shiftOtOption.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

// Use SHIFT_OT_OPTION_VIEW for lookup to avoid needing a new permission seed now.
router.get(
  '/lookup',
  requirePermission('SHIFT_OT_OPTION_VIEW'),
  shiftOtOptionController.lookupShiftOTOptions,
)

router.get(
  '/',
  requirePermission('SHIFT_OT_OPTION_VIEW'),
  shiftOtOptionController.listShiftOTOptions,
)

router.get(
  '/:id',
  requirePermission('SHIFT_OT_OPTION_VIEW'),
  shiftOtOptionController.getShiftOTOptionDetail,
)

router.post(
  '/',
  requirePermission('SHIFT_OT_OPTION_CREATE'),
  shiftOtOptionController.createShiftOTOption,
)

router.patch(
  '/:id',
  requirePermission('SHIFT_OT_OPTION_UPDATE'),
  shiftOtOptionController.updateShiftOTOption,
)

module.exports = router