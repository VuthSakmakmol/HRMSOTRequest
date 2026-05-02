// frontend/src/modules/org/line.api.js

import api from '@/shared/services/api'

export function getLines(params = {}) {
  return api.get('/org/lines', { params })
}

export function getLineById(id) {
  return api.get(`/org/lines/${id}`)
}

export function createLine(payload) {
  return api.post('/org/lines', payload)
}

export function updateLine(id, payload) {
  return api.patch(`/org/lines/${id}`, payload)
}

export function getLineLookupOptions(params = {}) {
  return api.get('/org/lines/lookup', { params })
}

export function getDepartmentLookupOptions(params = {}) {
  return api.get('/org/departments/lookup', { params })
}

export function getPositionLookupOptions(params = {}) {
  return api.get('/org/positions/lookup', { params })
}