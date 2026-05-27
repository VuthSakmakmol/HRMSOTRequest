// frontend/src/modules/ot/ot.api.js

import api from '@/shared/services/api'
import { normalizeOTAxiosResponse } from './otDisplay'

function normalize(response) {
  return normalizeOTAxiosResponse(response)
}

export function getOTRequests(params = {}) {
  return api.get('/ot/requests', { params }).then(normalize)
}

export function getOTRequestById(id) {
  return api.get(`/ot/requests/${id}`).then(normalize)
}

export function createOTRequest(payload) {
  return api.post('/ot/requests', payload).then(normalize)
}

export function updateOTRequest(id, payload) {
  return api.patch(`/ot/requests/${id}`, payload).then(normalize)
}

export function cancelOTRequest(id) {
  return api.post(`/ot/requests/${id}/cancel`).then(normalize)
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

export function getShiftOTOptionsByShift(shiftId, params = {}) {
  return api.get(`/ot/shift-options/by-shift/${shiftId}`, { params })
}

export function getShiftLookupOptions(params = {}) {
  return api.get('/shift/lookup', {
    params: {
      page: 1,
      limit: 100,
      isActive: true,
      ...params,
    },
  })
}

export function getUnavailableOTEmployees(params = {}) {
  return api.get('/ot/requests/unavailable-employees', { params })
}

export function getOTApprovalInbox(params = {}) {
  return api.get('/ot/approvals', { params }).then(normalize)
}

export function decideOTRequest(id, payload) {
  return api.post(`/ot/approvals/${id}/decision`, payload).then(normalize)
}

export function exportOTApprovalInboxExcel(params = {}) {
  return api.get('/ot/approvals/export', {
    params,
    responseType: 'blob',
  })
}

export function getOTAcknowledgementInbox(params = {}) {
  return api.get('/ot/acknowledgements', { params }).then(normalize)
}

export function acknowledgeOTRequest(id, payload = {}) {
  return api.post(`/ot/acknowledgements/${id}/acknowledge`, payload).then(normalize)
}