// frontend/src/modules/attendance/attendance.api.js

import api from '@/shared/services/api'
import { toApiDate } from '@/shared/utils/dateFormat'

const ATTENDANCE_IMPORT_TIMEOUT_MS = 30 * 60 * 1000
const ATTENDANCE_LIST_TIMEOUT_MS = 5 * 60 * 1000
const ATTENDANCE_VERIFY_TIMEOUT_MS = 5 * 60 * 1000

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

function normalizeDateParam(value) {
  return toApiDate(value, '') || undefined
}

function normalizeAttendanceRecordParams(params = {}) {
  return {
    ...params,
    attendanceDateFrom: normalizeDateParam(params.attendanceDateFrom),
    attendanceDateTo: normalizeDateParam(params.attendanceDateTo),
  }
}

function normalizeAttendanceImportParams(params = {}) {
  return {
    ...params,
    periodFrom: normalizeDateParam(params.periodFrom),
    periodTo: normalizeDateParam(params.periodTo),
  }
}

function normalizeVerificationSearchParams(params = {}) {
  return {
    ...params,
    otDateFrom: normalizeDateParam(params.otDateFrom),
    otDateTo: normalizeDateParam(params.otDateTo),
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
    timeout: ATTENDANCE_LIST_TIMEOUT_MS,
  })
}

export function importAttendanceExcel(input = {}, options = {}) {
  const { onUploadProgress } = options

  return api.post('/attendance/import', buildAttendanceImportFormData(input, options), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: ATTENDANCE_IMPORT_TIMEOUT_MS,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    onUploadProgress,
  })
}

export function getAttendanceImports(params = {}) {
  return api.get('/attendance/imports', {
    params: normalizeAttendanceImportParams(params),
    timeout: ATTENDANCE_LIST_TIMEOUT_MS,
  })
}

export function getAttendanceImportById(id) {
  return api.get(`/attendance/imports/${cleanId(id)}`, {
    timeout: ATTENDANCE_LIST_TIMEOUT_MS,
  })
}

// =========================
// Attendance Records
// =========================
export function getAttendanceRecords(params = {}) {
  return api.get('/attendance/records', {
    params: normalizeAttendanceRecordParams(params),
    timeout: ATTENDANCE_LIST_TIMEOUT_MS,
  })
}

export function getAttendanceRecordById(id) {
  return api.get(`/attendance/records/${cleanId(id)}`, {
    timeout: ATTENDANCE_LIST_TIMEOUT_MS,
  })
}

// =========================
// OT Attendance Verification
// =========================
export function searchOTRequestsForVerification(params = {}) {
  return api.get('/attendance/verification/ot/search', {
    params: normalizeVerificationSearchParams(params),
    timeout: ATTENDANCE_VERIFY_TIMEOUT_MS,
  })
}

// Old alias support.
export const searchOTVerificationRequests = searchOTRequestsForVerification

/**
 * Preview only.
 * Does not save payable minutes into OTRequest.
 */
export function previewOTAttendanceVerification(otRequestId) {
  return api.get(`/attendance/verification/ot/${cleanId(otRequestId)}`, {
    timeout: ATTENDANCE_VERIFY_TIMEOUT_MS,
  })
}

// Old alias support.
export const verifyOTAttendance = previewOTAttendanceVerification

/**
 * Save verification result.
 * This writes attendance/policy payable minutes into OTRequest.approvedEmployees.
 * Payment reads this saved result.
 */
export function verifyAndSaveOTAttendance(otRequestId) {
  return api.post(`/attendance/verification/ot/${cleanId(otRequestId)}/verify`, null, {
    timeout: ATTENDANCE_VERIFY_TIMEOUT_MS,
  })
}

// Extra alias support.
export const saveOTAttendanceVerification = verifyAndSaveOTAttendance

const attendanceService = {
  downloadAttendanceImportSample,
  importAttendanceExcel,
  getAttendanceImports,
  getAttendanceImportById,

  getAttendanceRecords,
  getAttendanceRecordById,

  searchOTRequestsForVerification,
  searchOTVerificationRequests,
  previewOTAttendanceVerification,
  verifyOTAttendance,
  verifyAndSaveOTAttendance,
  saveOTAttendanceVerification,
}

export default attendanceService
