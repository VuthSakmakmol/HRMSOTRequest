// backend/src/modules/attendance/routes/dailyVerification.routes.js

const express = require('express')

const requirePermission = require('../../../middlewares/requirePermission.middleware')
const controller = require('../controllers/otDailyVerification.controller')

const router = express.Router()

router.get('/', requirePermission('ATTENDANCE_VERIFY'), controller.listDaily)
router.get('/export', requirePermission('ATTENDANCE_VERIFY'), controller.exportDaily)
router.get('/history', requirePermission('ATTENDANCE_VERIFY'), controller.history)
router.post('/create-attendance', requirePermission('ATTENDANCE_VERIFY'), controller.createAttendance)
router.post('/create-ot-request', requirePermission('ATTENDANCE_VERIFY'), controller.createOTRequest)
router.post('/recover-attendance', requirePermission('ATTENDANCE_VERIFY'), controller.recoverAttendance)

module.exports = router
