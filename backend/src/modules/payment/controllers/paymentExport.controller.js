// backend/src/modules/payment/controllers/paymentExport.controller.js

const paymentExportService = require('../services/paymentExport.service')
const paymentProcessJobService = require('../services/paymentProcessJob.service')
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
      selectedDates: payload.selectedDates,
      formulaId: payload.formulaId,
      exchangeRate: payload.exchangeRate,
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
      selectedDates: payload.selectedDates,
      formulaId: payload.formulaId,
      exchangeRate: payload.exchangeRate,
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


async function startPaymentPreviewJob(req, res, next) {
  try {
    const payload = parseBody(paymentPreviewBodySchema, req.body || {})

    const job = paymentProcessJobService.startPaymentPreviewJob(
      {
        salaryFile: req.file,
        fromDate: payload.fromDate,
        toDate: payload.toDate,
        selectedDates: payload.selectedDates,
        formulaId: payload.formulaId,
        exchangeRate: payload.exchangeRate,
      },
      req.user,
    )

    res.status(202).json({
      success: true,
      data: job,
    })
  } catch (error) {
    next(error)
  }
}

async function startPaymentExportJob(req, res, next) {
  try {
    const payload = parseBody(paymentExportBodySchema, req.body || {})

    const job = paymentProcessJobService.startPaymentExportJob(
      {
        salaryFile: req.file,
        fromDate: payload.fromDate,
        toDate: payload.toDate,
        selectedDates: payload.selectedDates,
        formulaId: payload.formulaId,
        exchangeRate: payload.exchangeRate,
      },
      req.user,
    )

    res.status(202).json({
      success: true,
      data: job,
    })
  } catch (error) {
    next(error)
  }
}

async function getPaymentJobStatus(req, res, next) {
  try {
    const data = paymentProcessJobService.getPaymentJobStatus(req.params.jobId)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
}

async function downloadPaymentJobResult(req, res, next) {
  try {
    const result = paymentProcessJobService.getPaymentExportDownload(req.params.jobId)

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
  startPaymentPreviewJob,
  startPaymentExportJob,
  getPaymentJobStatus,
  downloadPaymentJobResult,
}