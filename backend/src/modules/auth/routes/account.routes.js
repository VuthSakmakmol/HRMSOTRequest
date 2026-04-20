// backend/src/modules/auth/routes/account.routes.js
const express = require('express')
const controller = require('../controllers/account.controller')
const requireAuth = require('../../../middlewares/requireAuth')

const router = express.Router()

router.use(requireAuth)

router.get('/', controller.list)
router.get('/:id', controller.getOne)
router.post('/', controller.create)
router.patch('/:id', controller.update)
router.post('/:id/reset-password', controller.resetPassword)

module.exports = router