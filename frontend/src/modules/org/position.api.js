// frontend/src/modules/org/position.api.js

import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

const IMPORT_TIMEOUT_MS = 0
const EXPORT_TIMEOUT_MS = 0
const SAMPLE_TIMEOUT_MS = 0

function cleanId(id) {
  return encodeURIComponent(String(id ?? '').trim())
}

export function getPositionLookupOptions(params = {}) {
  return api.get('/org/positions/lookup', { params })
}

export function getPositions(params = {}) {
  return api.get('/org/positions', { params })
}

export function getPositionById(id) {
  return api.get(`/org/positions/${cleanId(id)}`)
}

export function createPosition(payload) {
  return api.post('/org/positions', payload)
}

export function updatePosition(id, payload) {
  return api.patch(`/org/positions/${cleanId(id)}`, payload)
}

export function exportPositionsExcel(params = {}) {
  return api.get('/org/positions/export', {
    params,
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
  })
}

export function downloadPositionImportSample() {
  return api.get('/org/positions/import-sample', {
    responseType: 'blob',
    timeout: SAMPLE_TIMEOUT_MS,
  })
}

export function importPositionsExcel(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/org/positions/import', toFileFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: IMPORT_TIMEOUT_MS,
    onUploadProgress,
  })
}
