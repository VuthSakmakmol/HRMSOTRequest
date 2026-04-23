// backend/src/modules/ot/routes/otPolicy.routes.js
const express = require('express')
const otPolicyController = require('../controllers/otPolicy.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.post(
  '/',
  requirePermission('OT_REQUEST_CREATE'),
  otPolicyController.createOTCalculationPolicy,
)

router.get(
  '/',
  requirePermission('OT_REQUEST_VIEW'),
  otPolicyController.listOTCalculationPolicies,
)

router.get(
  '/:id',
  requirePermission('OT_REQUEST_VIEW'),
  otPolicyController.getOTCalculationPolicyDetail,
)

router.patch(
  '/:id',
  requirePermission('OT_REQUEST_UPDATE'),
  otPolicyController.updateOTCalculationPolicy,
)

module.exports = router