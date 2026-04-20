// frontend/src/modules/auth/auth.api.js
import api from '@/shared/services/api'

export function loginApi(payload) {
  return api.post('/auth/login', payload)
}

export function getMeApi() {
  return api.get('/auth/me')
}