// backend/src/modules/payment/routes/payment.routes.js

const express = require('express')

const requireAuth = require('../../../middlewares/requireAuth')

const formulaRoutes = require('./paymentFormula.routes')
const processRoutes = require('./paymentProcess.routes')

const router = express.Router()

router.use(requireAuth)

router.use('/formulas', formulaRoutes)
router.use('/', processRoutes)

module.exports = router