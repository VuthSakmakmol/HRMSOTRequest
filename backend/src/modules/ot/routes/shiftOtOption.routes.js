// backend/src/modules/ot/routes/shiftOtOption.routes.js
const express = require('express')
const shiftOtOptionController = require('../controllers/shiftOtOption.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.post(
  '/',
  requirePermission('OT_REQUEST_CREATE'),
  shiftOtOptionController.createShiftOTOption,
)

router.get(
  '/',
  requirePermission('OT_REQUEST_VIEW'),
  shiftOtOptionController.listShiftOTOptions,
)

router.get(
  '/:id',
  requirePermission('OT_REQUEST_VIEW'),
  shiftOtOptionController.getShiftOTOptionDetail,
)

router.patch(
  '/:id',
  requirePermission('OT_REQUEST_UPDATE'),
  shiftOtOptionController.updateShiftOTOption,
)

module.exports = router