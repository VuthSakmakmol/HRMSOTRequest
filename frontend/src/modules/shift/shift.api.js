// frontend/src/modules/shift/shift.api.js

import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

const IMPORT_TIMEOUT_MS = 15 * 60 * 1000
const EXPORT_TIMEOUT_MS = 180000
const SAMPLE_TIMEOUT_MS = 60000
const LOOKUP_TIMEOUT_MS = 120000

function cleanId(id) {
  return encodeURIComponent(String(id ?? '').trim())
}

export function getShiftLookupOptions(params = {}) {
  return api.get('/shift/lookup', {
    params,
    timeout: LOOKUP_TIMEOUT_MS,
  })
}

export function getShifts(params = {}) {
  return api.get('/shift', { params })
}

export function getShiftById(id) {
  return api.get(`/shift/${cleanId(id)}`)
}

export function createShift(payload) {
  return api.post('/shift', payload)
}

export function updateShift(id, payload) {
  return api.patch(`/shift/${cleanId(id)}`, payload)
}

export function exportShiftsExcel(params = {}) {
  return api.get('/shift/export', {
    params,
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
  })
}

export function downloadShiftImportSample() {
  return api.get('/shift/import-sample', {
    responseType: 'blob',
    timeout: SAMPLE_TIMEOUT_MS,
  })
}

export function importShiftsExcel(input, options = {}) {
  const { onUploadProgress } = options

  const formData =
    typeof FormData !== 'undefined' && input instanceof FormData
      ? input
      : toFileFormData(input)

  return api.post('/shift/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: IMPORT_TIMEOUT_MS,
    onUploadProgress,
  })
}