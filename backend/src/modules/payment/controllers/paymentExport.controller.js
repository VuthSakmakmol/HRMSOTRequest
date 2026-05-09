// backend/src/modules/payment/controllers/paymentExport.controller.js

const { paymentExportBodySchema } = require('../validations/paymentExport.validation')
const { parseSalaryExcel } = require('../services/salaryExcelParser.service')
const { calculatePaymentExport } = require('../services/paymentCalculation.service')
const {
  buildPaymentWorkbook,
  buildSalaryTemplateWorkbook,
} = require('../services/paymentExcel.service')

function parse(schema, data) {
  const result = schema.safeParse(data)

  if (!result.success) {
    const message = result.error.errors?.[0]?.message || 'Invalid request'
    const error = new Error(message)
    error.statusCode = 400
    throw error
  }

  return result.data
}

function safeFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
}

function buildPreviewResponse(result = {}) {
  const summaryRows = Array.isArray(result.summaryRows) ? result.summaryRows : []
  const detailRows = Array.isArray(result.detailRows) ? result.detailRows : []
  const missingSalaryRows = Array.isArray(result.missingSalaryRows)
    ? result.missingSalaryRows
    : []
  const warningRows = Array.isArray(result.warningRows) ? result.warningRows : []

  const totalPayableHours = summaryRows.reduce(
    (sum, row) => sum + Number(row.totalPayableHours || 0),
    0
  )

  const totalAmount = summaryRows.reduce(
    (sum, row) => sum + Number(row.totalAmount || 0),
    0
  )

  return {
    success: true,
    message: 'Payment preview calculated successfully',
    formula: {
      id: result.formula?._id,
      code: result.formula?.code,
      name: result.formula?.name,
      currency: result.formula?.currency || 'USD',
      monthlyWorkingDays: result.formula?.monthlyWorkingDays,
      hoursPerDay: result.formula?.hoursPerDay,
      multipliers: result.formula?.multipliers,
      roundingDecimals: result.formula?.roundingDecimals,
    },
    period: {
      fromDate: result.fromDate,
      toDate: result.toDate,
    },
    summary: {
      employeeCount: summaryRows.length,
      detailCount: detailRows.length,
      missingSalaryCount: missingSalaryRows.length,
      warningCount: warningRows.length,
      totalPayableHours: Number(totalPayableHours.toFixed(4)),
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: result.formula?.currency || 'USD',
      requestCount: result.requestCount || 0,
      salaryExcelRows: result.salaryMeta?.rowsCount || 0,
      validSalaryRows: result.salaryMeta?.validCount || 0,
    },
    preview: {
      summaryRows: summaryRows.slice(0, 500),
      detailRows: detailRows.slice(0, 500),
      missingSalaryRows: missingSalaryRows.slice(0, 500),
      warningRows: warningRows.slice(0, 500),
    },
  }
}

async function previewPayment(req, res, next) {
  try {
    const payload = parse(paymentExportBodySchema, req.body)

    if (!req.file?.buffer) {
      const error = new Error('Salary Excel file is required')
      error.statusCode = 400
      throw error
    }

    const salaryMeta = parseSalaryExcel(req.file.buffer)

    const result = await calculatePaymentExport({
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      formulaId: payload.formulaId,
      salaryMap: salaryMeta.salaryMap,
      salaryMeta,
    })

    res.json(buildPreviewResponse(result))
  } catch (error) {
    next(error)
  }
}

async function calculateAndExportPayment(req, res, next) {
  try {
    const payload = parse(paymentExportBodySchema, req.body)

    if (!req.file?.buffer) {
      const error = new Error('Salary Excel file is required')
      error.statusCode = 400
      throw error
    }

    const salaryMeta = parseSalaryExcel(req.file.buffer)

    const result = await calculatePaymentExport({
      fromDate: payload.fromDate,
      toDate: payload.toDate,
      formulaId: payload.formulaId,
      salaryMap: salaryMeta.salaryMap,
      salaryMeta,
    })

    const buffer = buildPaymentWorkbook(result)

    const filename = `payment_${safeFileNamePart(payload.fromDate)}_to_${safeFileNamePart(
      payload.toDate
    )}.xlsx`

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

async function downloadSalaryTemplate(req, res, next) {
  try {
    const buffer = buildSalaryTemplateWorkbook()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', 'attachment; filename="salary_template.xlsx"')
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

module.exports = {
  previewPayment,
  calculateAndExportPayment,
  downloadSalaryTemplate,
}