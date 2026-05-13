// backend/src/modules/payment/routes/payment.routes.js

const express = require('express')

const requireAuth = require('../../../middlewares/requireAuth')

const formulaRoutes = require('./paymentFormula.routes')
const exchangeRateRoutes = require('./paymentExchangeRate.routes')
const processRoutes = require('./paymentProcess.routes')

const router = express.Router()

router.use(requireAuth)

router.use('/formulas', formulaRoutes)
router.use('/exchange-rates', exchangeRateRoutes)
router.use('/', processRoutes)

module.exports = router