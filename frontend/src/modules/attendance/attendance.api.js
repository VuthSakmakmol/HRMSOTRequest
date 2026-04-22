// frontend/src/modules/attendance/attendance.api.js
import api from '@/shared/services/api'

export function downloadAttendanceImportSample() {
  return api.get('/attendance/import/sample', {
    responseType: 'blob',
  })
}

export function importAttendanceExcel(formData, options = {}) {
  const { onUploadProgress } = options

  return api.post('/attendance/import', formData, {
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

export function verifyOTAttendance(otRequestId) {
  return api.get(`/attendance/verification/ot/${otRequestId}`)
}