// backend/src/modules/org/routes/index.js

const express = require('express')

const departmentRoutes = require('./department.routes')
const positionRoutes = require('./position.routes')
const employeeRoutes = require('./employee.routes')
const productionLineRoutes = require('./productionLine.routes')

const router = express.Router()

router.use('/departments', departmentRoutes)
router.use('/positions', positionRoutes)
router.use('/employees', employeeRoutes)
router.use('/lines', productionLineRoutes)

module.exports = router