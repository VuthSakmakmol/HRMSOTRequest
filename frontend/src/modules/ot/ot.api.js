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

export function exportOTRequestsExcel(params = {}) {
  return api.get('/ot/requests/export', {
    params,
    responseType: 'blob',
  })
}

export function getAllowedOTApproverChain(employeeId) {
  return api.get(`/ot/requests/allowed-approvers/${employeeId}`)
}

/**
 * Load OT options for selected shift.
 *
 * Important:
 * Send otDate so backend can calculate day type using internal holiday calendar:
 * - WORKING_DAY
 * - SUNDAY
 * - HOLIDAY
 *
 * Example:
 * getShiftOTOptionsByShift(shiftId, { otDate: '2026-05-09' })
 */
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

export function getOTAcknowledgementInbox(params = {}) {
  return api.get('/ot/acknowledgements', { params })
}