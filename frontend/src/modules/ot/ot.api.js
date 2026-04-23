// frontend/src/modules/ot/ot.api.js
import api from '@/shared/services/api'

export function getOTRequests(params = {}) {
  return api.get('/ot/requests', { params })
}

export function getOTRequestById(id) {
  return api.get(`/ot/requests/${id}`)
}

export function createOTRequest(payload) {
  return api.post('/ot/requests', payload)
}

export function updateOTRequest(id, payload) {
  return api.patch(`/ot/requests/${id}`, payload)
}

export function requesterConfirmOTRequest(id, payload) {
  return api.post(`/ot/requests/${id}/requester-confirmation`, payload)
}

export function exportOTRequestsExcel(params = {}) {
  return api.get('/ot/requests/export', {
    params,
    responseType: 'blob',
  })
}

export function getAllowedOTApproverChain(employeeId) {
  return api.get(`/ot/requests/allowed-approvers/${employeeId}`)
}

export function getShiftOTOptionsByShift(shiftId) {
  return api.get(`/ot/shift-options/by-shift/${shiftId}`)
}

export function getOTApprovalInbox(params = {}) {
  return api.get('/ot/approvals', { params })
}

export function decideOTRequest(id, payload) {
  return api.post(`/ot/approvals/${id}/decision`, payload)
}

export function exportOTApprovalInboxExcel(params = {}) {
  return api.get('/ot/approvals/export', {
    params,
    responseType: 'blob',
  })
}