// frontend/src/modules/org/position.api.js
import api from '@/shared/services/api'

export function getPositions(params = {}) {
  return api.get('/org/positions', { params })
}

export function getPositionById(id) {
  return api.get(`/org/positions/${id}`)
}

export function createPosition(payload) {
  return api.post('/org/positions', payload)
}

export function updatePosition(id, payload) {
  return api.patch(`/org/positions/${id}`, payload)
}

export function downloadPositionSample() {
  return api.get('/org/positions/sample', {
    responseType: 'blob',
  })
}

export function exportPositions(params = {}) {
  return api.get('/org/positions/export', {
    params,
    responseType: 'blob',
  })
}

export function importPositions(file) {
  const formData = new FormData()
  formData.append('file', file)

  return api.post('/org/positions/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}