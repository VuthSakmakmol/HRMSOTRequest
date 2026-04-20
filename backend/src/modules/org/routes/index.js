// backend/src/modules/org/routes/index.js
const express = require('express')

const positionRoutes = require('./position.routes')
const departmentRoutes = require('./department.routes')
const employeeRoutes = require('./employee.routes')

const router = express.Router()

router.use('/positions', positionRoutes)
router.use('/departments', departmentRoutes)
router.use('/employees', employeeRoutes)

module.exports = router