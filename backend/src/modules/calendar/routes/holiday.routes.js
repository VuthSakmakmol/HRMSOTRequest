// backend/src/modules/calendar/routes/holiday.routes.js
const express = require('express')
const holidayController = require('../controllers/holiday.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get('/', requirePermission('HOLIDAY_VIEW'), holidayController.list)
router.get('/:id', requirePermission('HOLIDAY_VIEW'), holidayController.getById)
router.post('/', requirePermission('HOLIDAY_CREATE'), holidayController.create)
router.patch('/:id', requirePermission('HOLIDAY_UPDATE'), holidayController.update)

module.exports = router