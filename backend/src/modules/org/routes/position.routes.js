// backend/src/modules/org/routes/position.routes.js
const express = require('express')
const multer = require('multer')

const controller = require('../controllers/position.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

router.use(requireAuth)

router.get('/sample', requirePermission('POSITION_VIEW'), controller.downloadSample)
router.get('/export', requirePermission('POSITION_VIEW'), controller.exportExcel)
router.post(
  '/import',
  requirePermission('POSITION_CREATE'),
  upload.single('file'),
  controller.importExcel,
)

router.get('/', requirePermission('POSITION_VIEW'), controller.list)
router.get('/:id', requirePermission('POSITION_VIEW'), controller.getOne)
router.post('/', requirePermission('POSITION_CREATE'), controller.create)
router.patch('/:id', requirePermission('POSITION_UPDATE'), controller.update)

module.exports = router