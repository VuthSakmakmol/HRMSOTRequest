// backend/src/modules/payment/routes/paymentFormula.routes.js

const express = require('express')

const paymentFormulaController = require('../controllers/paymentFormula.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.get(
  '/',
  requirePermission('PAYMENT_FORMULA_VIEW'),
  paymentFormulaController.listPaymentFormulas,
)

router.get(
  '/lookup',
  requirePermission('PAYMENT_FORMULA_LOOKUP'),
  paymentFormulaController.lookupPaymentFormulas,
)

router.get(
  '/:id',
  requirePermission('PAYMENT_FORMULA_VIEW'),
  paymentFormulaController.getPaymentFormulaById,
)

router.post(
  '/',
  requirePermission('PAYMENT_FORMULA_CREATE'),
  paymentFormulaController.createPaymentFormula,
)

router.patch(
  '/:id',
  requirePermission('PAYMENT_FORMULA_UPDATE'),
  paymentFormulaController.updatePaymentFormula,
)

module.exports = router