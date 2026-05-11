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

// Fixed routes must stay before '/:id'
router.get('/lookup', requirePermission('POSITION_LOOKUP'), controller.lookup)

router.get('/export', requirePermission('POSITION_VIEW'), controller.exportExcel)

router.get(
  '/import-sample',
  requirePermission('POSITION_VIEW'),
  controller.downloadImportSample,
)

router.post(
  '/import',
  requirePermission('POSITION_CREATE'),
  upload.single('file'),
  controller.importExcel,
)

router.get('/', requirePermission('POSITION_VIEW'), controller.list)

router.get('/:id', requirePermission('POSITION_VIEW'), controller.getById)

router.post('/', requirePermission('POSITION_CREATE'), controller.create)

router.patch('/:id', requirePermission('POSITION_UPDATE'), controller.update)

module.exports = router