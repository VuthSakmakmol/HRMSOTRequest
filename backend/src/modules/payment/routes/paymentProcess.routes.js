// backend/src/modules/payment/routes/paymentProcess.routes.js

const express = require('express')
const multer = require('multer')

const paymentExportController = require('../controllers/paymentExport.controller')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.get(
  '/salary-template',
  requirePermission('PAYMENT_PROCESS'),
  paymentExportController.downloadSalaryTemplate,
)

router.post(
  '/preview',
  requirePermission('PAYMENT_PROCESS'),
  upload.single('salaryFile'),
  paymentExportController.previewPayment,
)

router.post(
  '/calculate-export',
  requirePermission('PAYMENT_PROCESS'),
  upload.single('salaryFile'),
  paymentExportController.calculateAndExportPayment,
)

module.exports = router