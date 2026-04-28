// frontend/src/modules/shift/shift.api.js
import api from '@/shared/services/api'

export function getShiftLookupOptions(params = {}) {
  return api.get('/shift/lookup', { params })
}

export function getShifts(params = {}) {
  return api.get('/shift', { params })
}

export function getShiftById(id) {
  return api.get(`/shift/${id}`)
}

export function createShift(payload) {
  return api.post('/shift', payload)
}

export function updateShift(id, payload) {
  return api.patch(`/shift/${id}`, payload)
}

export function exportShiftsExcel(params = {}) {
  return api.get('/shift/export', {
    params,
    responseType: 'blob',
  })
}

export function downloadShiftImportSample() {
  return api.get('/shift/import-sample', {
    responseType: 'blob',
  })
}

export function importShiftsExcel(formData) {
  return api.post('/shift/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}