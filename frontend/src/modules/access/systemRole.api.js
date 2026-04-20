// frontend/src/modules/access/systemRole.api.js
import api from '@/shared/services/api'

export function getSystemRoles(params = {}) {
  return api.get('/access/roles', { params })
}

export function getSystemRoleById(id) {
  return api.get(`/access/roles/${id}`)
}

export function createSystemRole(payload) {
  return api.post('/access/roles', payload)
}

export function updateSystemRole(id, payload) {
  return api.patch(`/access/roles/${id}`, payload)
}

export function getPermissionOptions(params = {}) {
  return api.get('/access/permissions', { params })
}