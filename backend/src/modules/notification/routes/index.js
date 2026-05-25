// backend/src/modules/notification/routes/index.js

const express = require('express')

const requireAuth = require('../../../middlewares/requireAuth')
const notificationController = require('../controllers/notification.controller')

const router = express.Router()

function noStore(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')

  return next()
}

router.use(requireAuth)
router.use(noStore)

router.get('/', notificationController.listMyNotifications)
router.patch('/read-all', notificationController.markAllNotificationsRead)
router.patch('/:id/read', notificationController.markNotificationRead)

module.exports = router