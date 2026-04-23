// frontend/src/modules/org/department.api.js
import api from '@/shared/services/api'

export function getDepartmentLookupOptions(params = {}) {
  return api.get('/org/departments/lookup', { params })
}

export function getDepartments(params = {}) {
  return api.get('/org/departments', { params })
}

export function getDepartmentById(id) {
  return api.get(`/org/departments/${id}`)
}

export function createDepartment(payload) {
  return api.post('/org/departments', payload)
}

export function updateDepartment(id, payload) {
  return api.patch(`/org/departments/${id}`, payload)
}

export function exportDepartmentsExcel(params = {}) {
  return api.get('/org/departments/export', {
    params,
    responseType: 'blob',
  })
}

export function downloadDepartmentImportSample() {
  return api.get('/org/departments/import-sample', {
    responseType: 'blob',
  })
}

export function importDepartmentsExcel(formData) {
  return api.post('/org/departments/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}