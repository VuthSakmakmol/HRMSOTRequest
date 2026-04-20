// backend/src/modules/auth/routes/index.js
const express = require('express')
const authController = require('../controllers/auth.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const accountRoutes = require('./account.routes')

const router = express.Router()

router.post('/login', authController.login)
router.get('/me', requireAuth, authController.me)

router.use('/accounts', accountRoutes)

module.exports = router