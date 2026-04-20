// backend/src/modules/calendar/routes/index.js
const express = require('express')
const holidayRoutes = require('./holiday.routes')

const router = express.Router()

router.use('/holidays', holidayRoutes)

module.exports = router