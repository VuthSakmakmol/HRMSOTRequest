// backend/src/modules/org/routes/position.routes.js

const express = require('express')
const multer = require('multer')

const positionController = require('../controllers/position.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

// ✅ Important:
// Login token must be verified before permission middleware.
// Without this, req.user is empty and requirePermission returns 401.
router.use(requireAuth)

router.get(
  '/lookup',
  requirePermission('POSITION_LOOKUP'),
  positionController.lookupPositions,
)

router.get(
  '/export',
  requirePermission('POSITION_VIEW'),
  positionController.exportPositions,
)

router.get(
  '/import/sample',
  requirePermission('POSITION_VIEW'),
  positionController.downloadPositionImportSample,
)

router.post(
  '/import',
  requirePermission('POSITION_CREATE'),
  upload.single('file'),
  positionController.importPositions,
)

router.get(
  '/',
  requirePermission('POSITION_VIEW'),
  positionController.listPositions,
)

router.get(
  '/:code',
  requirePermission('POSITION_VIEW'),
  positionController.getPositionByCode,
)

router.post(
  '/',
  requirePermission('POSITION_CREATE'),
  positionController.createPosition,
)

router.patch(
  '/:code',
  requirePermission('POSITION_UPDATE'),
  positionController.updatePosition,
)

module.exports = router