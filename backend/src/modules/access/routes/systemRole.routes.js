// backend/src/modules/access/routes/systemRole.routes.js
const express = require('express')

const controller = require('../controllers/systemRole.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get('/', requirePermission('ROLE_VIEW'), controller.list)
router.get('/:id', requirePermission('ROLE_VIEW'), controller.getOne)
router.post('/', requirePermission('ROLE_CREATE'), controller.create)
router.patch('/:id', requirePermission('ROLE_UPDATE'), controller.update)

module.exports = router