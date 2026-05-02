// backend/src/modules/org/routes/productionLine.routes.js
// backend/src/modules/org/routes/productionLine.routes.js

const express = require('express')
const multer = require('multer')

const productionLineController = require('../controllers/productionLine.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.use(requireAuth)

// Important: fixed routes must stay before '/:id'

router.get(
  '/lookup',
  requirePermission('LINE_LOOKUP'),
  productionLineController.lookup,
)

router.get(
  '/export',
  requirePermission('LINE_VIEW'),
  productionLineController.exportExcel,
)

router.get(
  '/import/sample',
  requirePermission('LINE_VIEW'),
  productionLineController.downloadImportSample,
)

router.post(
  '/import',
  requirePermission('LINE_CREATE'),
  upload.single('file'),
  productionLineController.importExcel,
)

router.get(
  '/',
  requirePermission('LINE_VIEW'),
  productionLineController.list,
)

router.post(
  '/',
  requirePermission('LINE_CREATE'),
  productionLineController.create,
)

router.get(
  '/:id',
  requirePermission('LINE_VIEW'),
  productionLineController.getById,
)

router.patch(
  '/:id',
  requirePermission('LINE_UPDATE'),
  productionLineController.update,
)

module.exports = router