// frontend/src/modules/payment/payment.api.js
import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

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
// Payment Process
// =========================
export function downloadSalaryTemplate() {
  return api.get('/payment/salary-template', {
    responseType: 'blob',
  })
}

export function previewPayment(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/preview', toFileFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}

export function calculatePaymentExport(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/payment/calculate-export', toFileFormData(input), {
    responseType: 'blob',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}