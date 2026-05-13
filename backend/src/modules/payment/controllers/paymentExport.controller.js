// backend/src/modules/payment/controllers/paymentExport.controller.js

const paymentExportService = require('../services/paymentExport.service')
const {
  paymentExportBodySchema,
  paymentPreviewBodySchema,
  parseBody,
} = require('../validations/paymentExport.validation')

async function downloadSalaryTemplate(req, res, next) {
  try {
    const result = await paymentExportService.downloadSalaryTemplate()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    )

    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

async function previewPayment(req, res, next) {
  try {
    const payload = parseBody(paymentPreviewBodySchema, req.body || {})

    const data = await paymentExportService.previewPayment({
      salaryFile: req.file,
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      formulaId: payload.formulaId,
      exchangeRateId: payload.exchangeRateId,
      actor: req.user,
    })

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function calculateAndExportPayment(req, res, next) {
  try {
    const payload = parseBody(paymentExportBodySchema, req.body || {})

    const result = await paymentExportService.calculateAndExportPayment({
      salaryFile: req.file,
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      formulaId: payload.formulaId,
      exchangeRateId: payload.exchangeRateId,
      actor: req.user,
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    )

    res.send(result.buffer)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  downloadSalaryTemplate,
  previewPayment,
  calculateAndExportPayment,
}