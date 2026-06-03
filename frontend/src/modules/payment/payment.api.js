// frontend/src/modules/payment/payment.api.js

import api from '@/shared/services/api'

const PAYMENT_PROCESS_TIMEOUT_MS = 5 * 60 * 1000
const PAYMENT_LOOKUP_TIMEOUT_MS = 60000
const PAYMENT_PROGRESS_TIMEOUT_MS = 15000

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

  // Manual daily exchange rate. This is NOT saved.
  if (hasValue(input.exchangeRate)) {
    formData.append('exchangeRate', input.exchangeRate)
  }

  return formData
}

// =========================
// Payment Formulas
// =========================
export function getPaymentFormulas(params = {}) {
  return api.get('/payment/formulas', { params, timeout: PAYMENT_LOOKUP_TIMEOUT_MS })
}

export function getPaymentFormulaLookupOptions(params = {}) {
  return api.get('/payment/formulas/lookup', { params, timeout: PAYMENT_LOOKUP_TIMEOUT_MS })
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
// Payment Allowance Policies
// =========================
export function getPaymentAllowancePolicies(params = {}) {
  return api.get('/payment/allowance-policies', { params, timeout: PAYMENT_LOOKUP_TIMEOUT_MS })
}

export function getPaymentAllowancePolicyLookupOptions(params = {}) {
  return api.get('/payment/allowance-policies/lookup', { params, timeout: PAYMENT_LOOKUP_TIMEOUT_MS })
}

export function getPaymentAllowancePolicyById(id) {
  return api.get(`/payment/allowance-policies/${id}`)
}

export function createPaymentAllowancePolicy(payload) {
  return api.post('/payment/allowance-policies', payload)
}

export function updatePaymentAllowancePolicy(id, payload) {
  return api.patch(`/payment/allowance-policies/${id}`, payload)
}

// =========================
// Payment Process
// =========================
export function downloadSalaryTemplate() {
  return api.get('/payment/salary-template', {
    responseType: 'blob',
    timeout: PAYMENT_PROCESS_TIMEOUT_MS,
  })
}

export function previewPayment(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/preview', buildPaymentProcessFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
    timeout: PAYMENT_PROCESS_TIMEOUT_MS,
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
    timeout: PAYMENT_PROCESS_TIMEOUT_MS,
  })
}


export function startPaymentPreviewJob(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/preview-job', buildPaymentProcessFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
    timeout: PAYMENT_PROCESS_TIMEOUT_MS,
  })
}

export function startPaymentExportJob(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/calculate-export-job', buildPaymentProcessFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
    timeout: PAYMENT_PROCESS_TIMEOUT_MS,
  })
}

export function getPaymentProcessJobStatus(jobId) {
  return api.get(`/payment/jobs/${encodeURIComponent(String(jobId || ''))}/status`, {
    timeout: PAYMENT_PROGRESS_TIMEOUT_MS,
  })
}

export function downloadPaymentProcessJobResult(jobId) {
  return api.get(`/payment/jobs/${encodeURIComponent(String(jobId || ''))}/download`, {
    responseType: 'blob',
    timeout: PAYMENT_PROCESS_TIMEOUT_MS,
  })
}

// Keep old PaymentProcessView import name working.
export const calculatePaymentExport = calculateAndExportPayment