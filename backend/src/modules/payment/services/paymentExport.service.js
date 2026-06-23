// backend/src/modules/payment/services/paymentExport.service.js

const { buildPaymentPreview } = require('./paymentCalculation.service')
const {
  buildSalaryTemplateWorkbook,
  buildPaymentWorkbook,
} = require('./paymentExcel.service')

function s(value) {
  return String(value ?? '').trim()
}

function getActorLabel(actor = {}) {
  return (
    actor?.loginId ||
    actor?.username ||
    actor?.employeeNo ||
    actor?.email ||
    actor?.accountId ||
    actor?._id ||
    ''
  )
}

async function downloadSalaryTemplate() {
  return {
    filename: 'payment-salary-template.xlsx',
    buffer: await buildSalaryTemplateWorkbook(),
  }
}

async function previewPayment({ salaryFile, fromDate, toDate, selectedDates, formulaId, exchangeRate }) {
  return buildPaymentPreview({
    salaryFile,
    fromDate,
    toDate,
    selectedDates,
    formulaId,
    exchangeRate,
  })
}

async function calculateAndExportPayment({
  salaryFile,
  fromDate,
  toDate,
  selectedDates,
  formulaId,
  exchangeRate,
  actor,
}) {
  const data = await buildPaymentPreview({
    salaryFile,
    fromDate,
    toDate,
    selectedDates,
    formulaId,
    exchangeRate,
  })

  const safeFrom = s(fromDate).replace(/[^\d-]/g, '')
  const safeTo = s(toDate).replace(/[^\d-]/g, '')

  const buffer = await buildPaymentWorkbook({
    ...data,
    exportedBy: s(getActorLabel(actor)),
  })

  return {
    filename: `payment-report-${safeFrom}-to-${safeTo}.xlsx`,
    buffer,
  }
}

module.exports = {
  downloadSalaryTemplate,
  previewPayment,
  calculateAndExportPayment,
}