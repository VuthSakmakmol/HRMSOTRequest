// frontend/src/modules/org/line.api.js
import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

export function getLineLookupOptions(params = {}) {
  return api.get('/org/lines/lookup', {
    params: {
      page: 1,
      limit: 100,
      isActive: true,
      ...params,
    },
  })
}

export function getLines(params = {}) {
  return api.get('/org/lines', { params })
}

export function getLineById(lineId) {
  return api.get(`/org/lines/${lineId}`)
}

export function createLine(payload) {
  return api.post('/org/lines', payload)
}

export function updateLine(lineId, payload) {
  return api.patch(`/org/lines/${lineId}`, payload)
}

export function getDepartmentLookupOptions(params = {}) {
  return api.get('/org/departments/lookup', {
    params: {
      page: 1,
      limit: 100,
      isActive: true,
      ...params,
    },
  })
}

export function getPositionLookupOptions(params = {}) {
  return api.get('/org/positions/lookup', {
    params: {
      page: 1,
      limit: 100,
      isActive: true,
      ...params,
    },
  })
}

export function exportLinesExcel(params = {}) {
  return api.get('/org/lines/export', {
    params,
    responseType: 'blob',
  })
}

export function downloadLineImportSample() {
  return api.get('/org/lines/import-sample', {
    responseType: 'blob',
  })
}

export function importLinesExcel(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/org/lines/import', toFileFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}