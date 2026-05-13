// backend/src/modules/payment/routes/paymentExchangeRate.routes.js

const express = require('express')

const paymentExchangeRateController = require('../controllers/paymentExchangeRate.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.get(
  '/',
  requirePermission('PAYMENT_EXCHANGE_RATE_VIEW'),
  paymentExchangeRateController.listPaymentExchangeRates,
)

router.get(
  '/lookup',
  requirePermission('PAYMENT_EXCHANGE_RATE_VIEW'),
  paymentExchangeRateController.lookupPaymentExchangeRates,
)

router.get(
  '/:id',
  requirePermission('PAYMENT_EXCHANGE_RATE_VIEW'),
  paymentExchangeRateController.getPaymentExchangeRateById,
)

router.post(
  '/',
  requirePermission('PAYMENT_EXCHANGE_RATE_CREATE'),
  paymentExchangeRateController.createPaymentExchangeRate,
)

router.patch(
  '/:id',
  requirePermission('PAYMENT_EXCHANGE_RATE_UPDATE'),
  paymentExchangeRateController.updatePaymentExchangeRate,
)

module.exports = router