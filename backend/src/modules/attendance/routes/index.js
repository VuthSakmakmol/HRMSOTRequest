// backend/src/modules/attendance/routes/index.js

const express = require('express')

const requireAuth = require('../../../middlewares/requireAuth')

const importRoutes = require('./import.routes')
const recordRoutes = require('./record.routes')
const verificationRoutes = require('./verification.routes')
const dashboardRoutes = require('./dashboard.routes')
const scanRoutes = require('./scan.routes')
const dailyVerificationRoutes = require('./dailyVerification.routes')

const router = express.Router()

router.use(requireAuth)

router.use('/scan', scanRoutes)
// Keep daily reconciliation before legacy /verification routes.
router.use('/verification/daily', dailyVerificationRoutes)
router.use('/', importRoutes)
router.use('/records', recordRoutes)
router.use('/verification', verificationRoutes)
router.use('/dashboard', dashboardRoutes)

module.exports = router