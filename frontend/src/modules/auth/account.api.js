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

// Standard lookup: use employee lookup endpoint, not full employee list.
export function getEmployeeOptions(params = {}) {
  return api.get('/org/employees/lookup', {
    params: {
      page: 1,
      limit: 20,
      search: '',
      q: '',
      isActive: true,
      ...params,
    },
  })
}

// Standard lookup: use role lookup endpoint if your backend already has it.
// If your backend only has /access/roles, tell me and I will align this.
export function getRoleOptions(params = {}) {
  return api.get('/access/roles/lookup', {
    params: {
      page: 1,
      limit: 20,
      search: '',
      q: '',
      isActive: true,
      ...params,
    },
  })
}