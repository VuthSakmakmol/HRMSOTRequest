// frontend/src/modules/org/line.api.js

import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

const IMPORT_TIMEOUT_MS = 120000
const EXPORT_TIMEOUT_MS = 120000
const SAMPLE_TIMEOUT_MS = 60000

function cleanId(id) {
  return encodeURIComponent(String(id ?? '').trim())
}

export function getLineLookupOptions(params = {}) {
  return api.get('/org/lines/lookup', { params })
}

export function getLines(params = {}) {
  return api.get('/org/lines', { params })
}

export function getLineById(id) {
  return api.get(`/org/lines/${cleanId(id)}`)
}

export function createLine(payload) {
  return api.post('/org/lines', payload)
}

export function updateLine(id, payload) {
  return api.patch(`/org/lines/${cleanId(id)}`, payload)
}

export function exportLinesExcel(params = {}) {
  return api.get('/org/lines/export', {
    params,
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
  })
}

export function downloadLineImportSample() {
  return api.get('/org/lines/import-sample', {
    responseType: 'blob',
    timeout: SAMPLE_TIMEOUT_MS,
  })
}

export function importLinesExcel(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/org/lines/import', toFileFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: IMPORT_TIMEOUT_MS,
    onUploadProgress,
  })
}