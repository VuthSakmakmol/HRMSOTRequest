// backend/src/modules/ot/routes/otPolicy.routes.js
const express = require('express')

const otPolicyController = require('../controllers/otPolicy.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

// Use OT_POLICY_VIEW for lookup so it works with your current permission seed.
// Later, if you want stricter permission, we can add OT_POLICY_LOOKUP.
router.get(
  '/lookup',
  requirePermission('OT_POLICY_VIEW'),
  otPolicyController.lookupOTCalculationPolicies,
)

router.get(
  '/',
  requirePermission('OT_POLICY_VIEW'),
  otPolicyController.listOTCalculationPolicies,
)

router.get(
  '/:id',
  requirePermission('OT_POLICY_VIEW'),
  otPolicyController.getOTCalculationPolicyDetail,
)

router.post(
  '/',
  requirePermission('OT_POLICY_CREATE'),
  otPolicyController.createOTCalculationPolicy,
)

router.patch(
  '/:id',
  requirePermission('OT_POLICY_UPDATE'),
  otPolicyController.updateOTCalculationPolicy,
)

module.exports = router