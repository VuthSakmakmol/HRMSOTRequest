// frontend/src/modules/attendance/attendance.api.js

import api from '@/shared/services/api'
import { toApiDate } from '@/shared/utils/dateFormat'

// =========================
// Helpers
// =========================
function cleanId(id) {
  return encodeURIComponent(String(id ?? '').trim())
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function isFileLike(value) {
  return (
    value instanceof File ||
    value instanceof Blob ||
    (value && typeof value === 'object' && hasValue(value.name) && hasValue(value.size))
  )
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (hasValue(value)) return value
  }

  return ''
}

function normalizeImportInput(input = {}, options = {}) {
  // Supports old call:
  // importAttendanceExcel(file, { payload: { attendanceDate, sourceType }, onUploadProgress })
  if (isFileLike(input)) {
    return {
      file: input,
      ...(options.payload || {}),
    }
  }

  // Supports new call:
  // importAttendanceExcel({ file, attendanceDate, sourceType })
  return {
    ...(input || {}),
    ...(options.payload || {}),
  }
}

function buildAttendanceImportFormData(input = {}, options = {}) {
  const normalized = normalizeImportInput(input, options)
  const formData = new FormData()

  const file = pickFirstValue(
    normalized.file,
    normalized.attendanceFile,
    normalized.excelFile,
    normalized.selectedFile,
  )

  const rawAttendanceDate = pickFirstValue(
    normalized.attendanceDate,
    normalized.date,
    normalized.importDate,
    normalized.selectedDate,
    normalized.workDate,
    normalized.otDate,
  )

  const attendanceDate = toApiDate(rawAttendanceDate, '')

  if (file) {
    formData.append('file', file)
  }

  if (attendanceDate) {
    formData.append('attendanceDate', attendanceDate)
  }

  if (hasValue(normalized.sourceType)) {
    formData.append('sourceType', normalized.sourceType)
  }

  if (hasValue(normalized.remark)) {
    formData.append('remark', normalized.remark)
  }

  return formData
}

// =========================
// Attendance Import
// =========================
export function downloadAttendanceImportSample() {
  return api.get('/attendance/import/sample', {
    responseType: 'blob',
  })
}

export function importAttendanceExcel(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/attendance/import', buildAttendanceImportFormData(input, options), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  })
}

export function getAttendanceImports(params = {}) {
  return api.get('/attendance/imports', { params })
}

export function getAttendanceImportById(id) {
  return api.get(`/attendance/imports/${cleanId(id)}`)
}

// =========================
// Attendance Records
// =========================
export function getAttendanceRecords(params = {}) {
  return api.get('/attendance/records', { params })
}

export function getAttendanceRecordById(id) {
  return api.get(`/attendance/records/${cleanId(id)}`)
}

// =========================
// OT Attendance Verification
// =========================
export function searchOTRequestsForVerification(params = {}) {
  return api.get('/attendance/verification/ot/search', { params })
}

// Old alias support.
export const searchOTVerificationRequests = searchOTRequestsForVerification

/**
 * Preview only.
 * Does not save payable minutes into OTRequest.
 */
export function previewOTAttendanceVerification(otRequestId) {
  return api.get(`/attendance/verification/ot/${cleanId(otRequestId)}`)
}

// Old alias support.
export const verifyOTAttendance = previewOTAttendanceVerification

/**
 * Save verification result.
 * This writes attendance/policy payable minutes into OTRequest.approvedEmployees.
 * Payment reads this saved result.
 */
export function verifyAndSaveOTAttendance(otRequestId) {
  return api.post(`/attendance/verification/ot/${cleanId(otRequestId)}/verify`)
}

// Extra alias support.
export const saveOTAttendanceVerification = verifyAndSaveOTAttendance