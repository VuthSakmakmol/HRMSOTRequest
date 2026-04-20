// frontend/src/modules/access/permission.api.js
import api from '@/shared/services/api'

export function getPermissions(params = {}) {
  return api.get('/access/permissions', { params })
}

export function getPermissionById(id) {
  return api.get(`/access/permissions/${id}`)
}