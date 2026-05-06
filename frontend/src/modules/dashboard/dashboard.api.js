// frontend/src/modules/dashboard/dashboard.api.js
// frontend/src/modules/dashboard/dashboard.api.js

import api from '@/shared/services/api'

export function getDepartmentDashboardSummary() {
  return api.get('/org/dashboard/departments/summary')
}

export function getPositionDashboardSummary() {
  return api.get('/org/dashboard/positions/summary')
}

export function getEmployeeDashboardSummary() {
  return api.get('/org/dashboard/employees/summary')
}

export function getOTDashboardSummary() {
  return api.get('/ot/dashboard/summary')
}

export function getAttendanceDashboardSummary() {
  return api.get('/attendance/dashboard/summary')
}