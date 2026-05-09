// backend/src/modules/payment/routes/payment.routes.js

const express = require('express')
const multer = require('multer')

const requireAuth = require('../../../middlewares/requireAuth')
const requirePermission = require('../../../middlewares/requirePermission.middleware')

const paymentFormulaController = require('../controllers/paymentFormula.controller')
const paymentExportController = require('../controllers/paymentExport.controller')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.use(requireAuth)

// =========================
// Payment Formula
// =========================
router.get(
  '/formulas',
  requirePermission('PAYMENT_FORMULA_VIEW'),
  paymentFormulaController.listPaymentFormulas
)

router.get(
  '/formulas/lookup',
  requirePermission('PAYMENT_FORMULA_VIEW'),
  paymentFormulaController.lookupPaymentFormulas
)

router.get(
  '/formulas/:id',
  requirePermission('PAYMENT_FORMULA_VIEW'),
  paymentFormulaController.getPaymentFormulaById
)

router.post(
  '/formulas',
  requirePermission('PAYMENT_FORMULA_CREATE'),
  paymentFormulaController.createPaymentFormula
)

router.patch(
  '/formulas/:id',
  requirePermission('PAYMENT_FORMULA_UPDATE'),
  paymentFormulaController.updatePaymentFormula
)

// =========================
// Payment Process
// =========================
router.get(
  '/salary-template',
  requirePermission('PAYMENT_PROCESS'),
  paymentExportController.downloadSalaryTemplate
)

router.post(
  '/calculate-export',
  requirePermission('PAYMENT_PROCESS'),
  upload.single('salaryFile'),
  paymentExportController.calculateAndExportPayment
)

router.post(
  '/preview',
  requirePermission('PAYMENT_PROCESS'),
  upload.single('salaryFile'),
  paymentExportController.previewPayment
)

module.exports = router