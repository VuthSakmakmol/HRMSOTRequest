// backend/src/modules/shift/routes/shift.routes.js
const express = require('express')
const shiftController = require('../controllers/shift.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get('/', requirePermission('SHIFT_VIEW'), shiftController.list)
router.get('/:id', requirePermission('SHIFT_VIEW'), shiftController.getById)
router.post('/', requirePermission('SHIFT_CREATE'), shiftController.create)
router.patch('/:id', requirePermission('SHIFT_UPDATE'), shiftController.update)

module.exports = router