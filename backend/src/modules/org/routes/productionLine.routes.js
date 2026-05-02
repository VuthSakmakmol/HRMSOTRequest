// backend/src/modules/org/routes/productionLine.routes.js

const express = require('express')

const productionLineController = require('../controllers/productionLine.controller')
const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

router.use(requireAuth)

router.get(
  '/lookup',
  requirePermission('LINE_LOOKUP'),
  productionLineController.lookup,
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