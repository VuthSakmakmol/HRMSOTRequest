// backend/src/routes/index.js
const express = require('express')

const authRoutes = require('../modules/auth/routes')
const orgRoutes = require('../modules/org/routes')
const accessRoutes = require('../modules/access/routes')
const calendarRoutes = require('../modules/calendar/routes')
const otRoutes = require('../modules/ot/routes')
const shiftRoutes = require('../modules/shift/routes')
const attendanceRoutes = require('../modules/attendance/routes')

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/org', orgRoutes)
router.use('/access', accessRoutes)
router.use('/calendar', calendarRoutes)
router.use('/ot', otRoutes)
router.use('/shift', shiftRoutes)
router.use('/attendance', attendanceRoutes)

module.exports = router