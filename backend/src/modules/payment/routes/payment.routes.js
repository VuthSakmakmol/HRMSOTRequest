// backend/src/modules/payment/routes/payment.routes.js

const express = require('express')

const requireAuth = require('../../../middlewares/requireAuth')

const formulaRoutes = require('./paymentFormula.routes')
const processRoutes = require('./paymentProcess.routes')
const allowancePolicyRoutes = require('../../allowance/routes/allowancePolicy.routes')

const router = express.Router()

router.use(requireAuth)

// =========================
// Payment Formula Routes
// Base: /api/v1/payment/formulas
// =========================
router.use('/formulas', formulaRoutes)

// =========================
// Payment Allowance Policy Routes
// Base: /api/v1/payment/allowance-policies
// =========================
router.use('/allowance-policies', allowancePolicyRoutes)

// =========================
// Payment Process Routes
// Base: /api/v1/payment
// Examples:
// /salary-template
// /preview
// /calculate-export
// =========================
router.use('/', processRoutes)

module.exports = router