// frontend/src/modules/org/employee.api.js

import api from '@/shared/services/api'
import { toFileFormData } from '@/shared/utils/formData'

const IMPORT_TIMEOUT_MS = 180000
const EXPORT_TIMEOUT_MS = 180000
const SAMPLE_TIMEOUT_MS = 60000

function cleanId(id) {
  return encodeURIComponent(String(id ?? '').trim())
}

export function getEmployeeLookupOptions(params = {}) {
  return api.get('/org/employees/lookup', { params })
}

export function getEmployees(params = {}) {
  return api.get('/org/employees', { params })
}

export function getEmployeeById(id) {
  return api.get(`/org/employees/${cleanId(id)}`)
}

export function getEmployeeOrgChart(id) {
  return api.get(`/org/employees/${cleanId(id)}/org-chart`)
}

export function getEmployeeOrgTree(params = {}) {
  return api.get('/org/employees/org-chart/tree', { params })
}

export function createEmployee(payload) {
  return api.post('/org/employees', payload)
}

export function updateEmployee(id, payload) {
  return api.patch(`/org/employees/${cleanId(id)}`, payload)
}

export function exportEmployeesExcel(params = {}) {
  return api.get('/org/employees/export', {
    params,
    responseType: 'blob',
    timeout: EXPORT_TIMEOUT_MS,
  })
}

export function downloadEmployeeImportSample() {
  return api.get('/org/employees/import-sample', {
    responseType: 'blob',
    timeout: SAMPLE_TIMEOUT_MS,
  })
}

export function importEmployeesExcel(input, options = {}) {
  const { onUploadProgress } = options

  return api.post('/org/employees/import', toFileFormData(input), {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: IMPORT_TIMEOUT_MS,
    onUploadProgress,
  })
}