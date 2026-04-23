// frontend/src/modules/org/employee.api.js
// frontend/src/modules/org/employee.api.js
import api from '@/shared/services/api'

export function getEmployeeLookupOptions(params = {}) {
  return api.get('/org/employees/lookup', { params })
}

export function getEmployees(params = {}) {
  return api.get('/org/employees', { params })
}

export function getEmployeeById(id) {
  return api.get(`/org/employees/${id}`)
}

export function getEmployeeOrgChart(id) {
  return api.get(`/org/employees/${id}/org-chart`)
}

export function getEmployeeOrgTree(params = {}) {
  return api.get('/org/employees/org-chart/tree', { params })
}

export function createEmployee(payload) {
  return api.post('/org/employees', payload)
}

export function updateEmployee(id, payload) {
  return api.patch(`/org/employees/${id}`, payload)
}

export function exportEmployeesExcel(params = {}) {
  return api.get('/org/employees/export', {
    params,
    responseType: 'blob',
  })
}

export function downloadEmployeeImportSample() {
  return api.get('/org/employees/import-sample', {
    responseType: 'blob',
  })
}

export function importEmployeesExcel(file) {
  const formData = new FormData()
  formData.append('file', file)

  return api.post('/org/employees/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}