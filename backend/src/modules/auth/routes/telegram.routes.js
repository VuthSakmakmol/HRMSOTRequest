// backend/src/modules/auth/routes/telegram.routes.js

const express = require('express')

const requireAuth = require('../../../middlewares/requireAuth')
const controller = require('../controllers/telegramAccount.controller')

const router = express.Router()

router.use(requireAuth)

router.get('/status', controller.getStatus)
router.post('/connect-link', controller.createConnectLink)
router.post('/disconnect', controller.disconnect)

module.exports = router