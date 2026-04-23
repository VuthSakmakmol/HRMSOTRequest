// frontend/src/modules/ot/otMaster.api.js
import api from '@/shared/services/api'

// =========================
// OT Calculation Policies
// =========================
export function getOTCalculationPolicies(params = {}) {
  return api.get('/ot/policies', { params })
}

export function getOTCalculationPolicyById(id) {
  return api.get(`/ot/policies/${id}`)
}

export function createOTCalculationPolicy(payload) {
  return api.post('/ot/policies', payload)
}

export function updateOTCalculationPolicy(id, payload) {
  return api.patch(`/ot/policies/${id}`, payload)
}

// =========================
// Shift OT Options
// =========================
export function getShiftOTOptions(params = {}) {
  return api.get('/ot/shift-options', { params })
}

export function getShiftOTOptionById(id) {
  return api.get(`/ot/shift-options/${id}`)
}

export function createShiftOTOption(payload) {
  return api.post('/ot/shift-options', payload)
}

export function updateShiftOTOption(id, payload) {
  return api.patch(`/ot/shift-options/${id}`, payload)
}