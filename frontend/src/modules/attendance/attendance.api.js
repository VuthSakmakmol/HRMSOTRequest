// frontend/src/modules/attendance/attendance.api.js

import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

function buildImportFormData(input, payload = {}) {
  if (input instanceof FormData) {
    return input
  }

  const formData = toFileFormData(input)

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      formData.append(key, value)
    }
  })

  return formData
}

export function downloadAttendanceImportSample() {
  return api.get('/attendance/import/sample', {
    responseType: 'blob',
  })
}

export function importAttendanceExcel(input, options = {}) {
  const { onUploadProgress, payload = {} } = options

  return api.post('/attendance/import', buildImportFormData(input, payload), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}

export function getAttendanceImports(params = {}) {
  return api.get('/attendance/imports', { params })
}

export function getAttendanceImportById(importId) {
  return api.get(`/attendance/imports/${importId}`)
}

export function getAttendanceRecords(params = {}) {
  return api.get('/attendance/records', { params })
}

export function getAttendanceRecordById(recordId) {
  return api.get(`/attendance/records/${recordId}`)
}

export function exportAttendanceRecordsExcel(params = {}) {
  return api.get('/attendance/records/export', {
    params,
    responseType: 'blob',
  })
}

export function searchOTVerificationRequests(params = {}) {
  return api.get('/attendance/verification/ot/search', { params })
}

export function verifyOTAttendance(otRequestId, params = {}) {
  return api.get(`/attendance/verification/ot/${otRequestId}`, { params })
}

export function getAttendanceDashboardSummary() {
  return api.get('/attendance/dashboard/summary')
}