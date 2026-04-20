// backend/src/modules/org/routes/permission.routes.js
const express = require('express')
const controller = require('../controllers/permission.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get('/', requirePermission('PERMISSION_VIEW'), controller.list)
router.get('/:id', requirePermission('PERMISSION_VIEW'), controller.getOne)

module.exports = router