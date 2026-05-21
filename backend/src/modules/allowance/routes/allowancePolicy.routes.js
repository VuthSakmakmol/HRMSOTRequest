// backend/src/modules/allowance/routes/allowancePolicy.routes.js

const express = require('express')

const paymentAllowancePolicyController = require('../controllers/paymentAllowancePolicy.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.get(
  '/',
  requirePermission('PAYMENT_ALLOWANCE_POLICY_VIEW'),
  paymentAllowancePolicyController.listPaymentAllowancePolicies,
)

router.get(
  '/lookup',
  requirePermission('PAYMENT_ALLOWANCE_POLICY_VIEW'),
  paymentAllowancePolicyController.lookupPaymentAllowancePolicies,
)

router.get(
  '/:id',
  requirePermission('PAYMENT_ALLOWANCE_POLICY_VIEW'),
  paymentAllowancePolicyController.getPaymentAllowancePolicyById,
)

router.post(
  '/',
  requirePermission('PAYMENT_ALLOWANCE_POLICY_CREATE'),
  paymentAllowancePolicyController.createPaymentAllowancePolicy,
)

router.patch(
  '/:id',
  requirePermission('PAYMENT_ALLOWANCE_POLICY_UPDATE'),
  paymentAllowancePolicyController.updatePaymentAllowancePolicy,
)

module.exports = router