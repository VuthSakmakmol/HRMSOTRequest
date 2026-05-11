// backend/src/modules/org/routes/productionLine.routes.js

const express = require('express')
const multer = require('multer')

const controller = require('../controllers/productionLine.controller')
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
router.get('/lookup', requirePermission('LINE_LOOKUP'), controller.lookup)

router.get('/export', requirePermission('LINE_VIEW'), controller.exportExcel)

router.get(
  '/import-sample',
  requirePermission('LINE_VIEW'),
  controller.downloadImportSample,
)

router.post(
  '/import',
  requirePermission('LINE_CREATE'),
  upload.single('file'),
  controller.importExcel,
)

router.get('/', requirePermission('LINE_VIEW'), controller.list)

router.post('/', requirePermission('LINE_CREATE'), controller.create)

router.get('/:id', requirePermission('LINE_VIEW'), controller.getById)

router.patch('/:id', requirePermission('LINE_UPDATE'), controller.update)

module.exports = router