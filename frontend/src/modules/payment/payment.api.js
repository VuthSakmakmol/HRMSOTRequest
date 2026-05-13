// frontend/src/modules/payment/payment.api.js

import api from '@/shared/services/api'

// =========================
// Helpers
// =========================
function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function buildPaymentProcessFormData(input = {}) {
  const formData = new FormData()

  const salaryFile = input.salaryFile || input.file

  if (salaryFile) {
    formData.append('salaryFile', salaryFile)
  }

  if (hasValue(input.fromDate)) {
    formData.append('fromDate', input.fromDate)
  }

  if (hasValue(input.toDate)) {
    formData.append('toDate', input.toDate)
  }

  if (hasValue(input.formulaId)) {
    formData.append('formulaId', input.formulaId)
  }

  if (hasValue(input.exchangeRateId)) {
    formData.append('exchangeRateId', input.exchangeRateId)
  }

  return formData
}

// =========================
// Payment Formulas
// =========================
export function getPaymentFormulas(params = {}) {
  return api.get('/payment/formulas', { params })
}

export function getPaymentFormulaLookupOptions(params = {}) {
  return api.get('/payment/formulas/lookup', { params })
}

export function getPaymentFormulaById(id) {
  return api.get(`/payment/formulas/${id}`)
}

export function createPaymentFormula(payload) {
  return api.post('/payment/formulas', payload)
}

export function updatePaymentFormula(id, payload) {
  return api.patch(`/payment/formulas/${id}`, payload)
}

// =========================
// Payment Exchange Rates
// =========================
export function getPaymentExchangeRates(params = {}) {
  return api.get('/payment/exchange-rates', { params })
}

export function getPaymentExchangeRateLookupOptions(params = {}) {
  return api.get('/payment/exchange-rates/lookup', { params })
}

export function getPaymentExchangeRateById(id) {
  return api.get(`/payment/exchange-rates/${id}`)
}

export function createPaymentExchangeRate(payload) {
  return api.post('/payment/exchange-rates', payload)
}

export function updatePaymentExchangeRate(id, payload) {
  return api.patch(`/payment/exchange-rates/${id}`, payload)
}

// =========================
// Payment Process
// =========================
export function downloadSalaryTemplate() {
  return api.get('/payment/salary-template', {
    responseType: 'blob',
  })
}

export function previewPayment(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/preview', buildPaymentProcessFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}

export function calculateAndExportPayment(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/calculate-export', buildPaymentProcessFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    responseType: 'blob',
    onUploadProgress,
  })
}

// Keep old PaymentProcessView import working
export const calculatePaymentExport = calculateAndExportPayment