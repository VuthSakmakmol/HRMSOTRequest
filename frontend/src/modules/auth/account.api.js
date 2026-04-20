// frontend/src/modules/auth/account.api.js
import api from '@/shared/services/api'

export function getAccounts(params = {}) {
  return api.get('/auth/accounts', { params })
}

export function getAccountById(accountId) {
  return api.get(`/auth/accounts/${accountId}`)
}

export function createAccount(payload) {
  return api.post('/auth/accounts', payload)
}

export function updateAccount(accountId, payload) {
  return api.patch(`/auth/accounts/${accountId}`, payload)
}

export function resetAccountPassword(accountId, payload) {
  return api.post(`/auth/accounts/${accountId}/reset-password`, payload)
}

export function getEmployeeOptions(params = {}) {
  return api.get('/org/employees', {
    params: {
      page: 1,
      limit: 100,
      isActive: true,
      ...params,
    },
  })
}

export function getRoleOptions(params = {}) {
  return api.get('/access/roles', {
    params: {
      page: 1,
      limit: 100,
      isActive: true,
      ...params,
    },
  })
}