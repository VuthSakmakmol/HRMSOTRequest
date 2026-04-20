// backend/src/modules/shift/routes/index.js
const express = require('express')
const shiftRoutes = require('./shift.routes')

const router = express.Router()

router.use('/', shiftRoutes)

module.exports = router