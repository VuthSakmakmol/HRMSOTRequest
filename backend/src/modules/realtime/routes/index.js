// backend/src/modules/realtime/routes/index.js
const express = require('express')
const controller = require('../controllers/realtime.controller')

const router = express.Router()

router.post('/ping', controller.ping)

module.exports = router