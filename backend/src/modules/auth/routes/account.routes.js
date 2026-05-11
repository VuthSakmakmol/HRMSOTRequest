// backend/src/modules/auth/routes/account.routes.js

const express = require('express')

const controller = require('../controllers/account.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get('/', requirePermission('ACCOUNT_VIEW'), controller.list)
router.get('/:id', requirePermission('ACCOUNT_VIEW'), controller.getOne)

router.post('/', requirePermission('ACCOUNT_CREATE'), controller.create)

router.patch('/:id', requirePermission('ACCOUNT_UPDATE'), controller.update)

router.post(
  '/:id/reset-password',
  requirePermission('ACCOUNT_RESET_PASSWORD'),
  controller.resetPassword,
)

module.exports = router