// frontend/src/modules/org/position.api.js

import api from '@/shared/services/api'

function cleanCode(code) {
  return encodeURIComponent(String(code ?? '').trim().toUpperCase())
}

export function getPositionLookupOptions(params = {}) {
  return api.get('/org/positions/lookup', { params })
}

export function getPositions(params = {}) {
  return api.get('/org/positions', { params })
}

export function getPositionByCode(code) {
  return api.get(`/org/positions/${cleanCode(code)}`)
}

export function createPosition(payload) {
  return api.post('/org/positions', payload)
}

export function updatePosition(code, payload) {
  return api.patch(`/org/positions/${cleanCode(code)}`, payload)
}

export function downloadPositionImportSample() {
  return api.get('/org/positions/import/sample', {
    responseType: 'blob',
  })
}

export function importPositionsExcel(file, options = {}) {
  const formData = new FormData()
  formData.append('file', file)

  return api.post('/org/positions/import', formData, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'multipart/form-data',
    },
  })
}

export function exportPositionsExcel(params = {}) {
  return api.get('/org/positions/export', {
    params,
    responseType: 'blob',
  })
}