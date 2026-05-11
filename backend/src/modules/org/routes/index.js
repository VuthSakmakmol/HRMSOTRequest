// backend/src/modules/org/routes/index.js

const express = require('express')

const dashboardRoutes = require('./dashboard.routes')
const departmentRoutes = require('./department.routes')
const positionRoutes = require('./position.routes')
const productionLineRoutes = require('./productionLine.routes')
const employeeRoutes = require('./employee.routes')

const router = express.Router()

router.use('/dashboard', dashboardRoutes)
router.use('/departments', departmentRoutes)
router.use('/positions', positionRoutes)
router.use('/lines', productionLineRoutes)
router.use('/employees', employeeRoutes)

module.exports = router