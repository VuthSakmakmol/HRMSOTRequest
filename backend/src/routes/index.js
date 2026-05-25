// backend/src/routes/index.js

const express = require('express')

const authRoutes = require('../modules/auth/routes')
const accessRoutes = require('../modules/access/routes')
const orgRoutes = require('../modules/org/routes')
const calendarRoutes = require('../modules/calendar/routes')
const shiftRoutes = require('../modules/shift/routes')
const attendanceRoutes = require('../modules/attendance/routes')
const otRoutes = require('../modules/ot/routes')
const paymentRoutes = require('../modules/payment/routes/payment.routes')
const notificationRoutes = require('../modules/notification/routes')

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/access', accessRoutes)
router.use('/org', orgRoutes)
router.use('/calendar', calendarRoutes)
router.use('/shift', shiftRoutes)
router.use('/attendance', attendanceRoutes)
router.use('/ot', otRoutes)
router.use('/payment', paymentRoutes)
router.use('/notifications', notificationRoutes)

module.exports = router