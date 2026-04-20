// frontend/src/modules/shift/shift.api.js
import api from '@/shared/services/api'

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