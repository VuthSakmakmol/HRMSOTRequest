// frontend/src/modules/auth/telegram.api.js

import api from '@/shared/services/api'

export function getTelegramStatus() {
  return api.get('/auth/telegram/status')
}

export function createTelegramConnectLink() {
  return api.post('/auth/telegram/connect-link')
}

export function disconnectTelegram() {
  return api.post('/auth/telegram/disconnect')
}