// frontend/src/modules/auth/auth.store.js

import { defineStore } from 'pinia'
import { loginApi, getMeApi } from './auth.api'

const TOKEN_KEY = 'ot_access_token'
const USER_KEY = 'ot_auth_user'

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function s(v) {
  return String(v ?? '').trim()
}

function up(v) {
  return s(v).toUpperCase()
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(up).filter(Boolean))]
}

function normalizeRoles(input) {
  if (!Array.isArray(input)) return []

  return input
    .map((role) => {
      if (typeof role === 'string') {
        return {
          id: '',
          code: up(role),
          displayName: s(role),
        }
      }

      return {
        id: s(role?.id || role?._id),
        code: up(role?.code),
        displayName: s(role?.displayName || role?.name || role?.code),
      }
    })
    .filter((role) => role.code)
}

function normalizeUser(user) {
  if (!user) return null

  return {
    id: s(user.id || user._id || user.accountId),
    accountId: s(user.accountId || user.id || user._id),
    loginId: s(user.loginId).toLowerCase(),
    displayName: s(user.displayName),
    employeeId: user.employeeId ? s(user.employeeId) : null,
    roleIds: Array.isArray(user.roleIds) ? user.roleIds.map((v) => s(v)).filter(Boolean) : [],
    roles: normalizeRoles(user.roles || user.roleCodes || []),
    roleCodes: uniqueStrings(
      user.roleCodes ||
        (Array.isArray(user.roles)
          ? user.roles.map((r) => (typeof r === 'string' ? r : r?.code))
          : []),
    ),
    directPermissionCodes: uniqueStrings(user.directPermissionCodes || []),
    effectivePermissionCodes: uniqueStrings(user.effectivePermissionCodes || []),
    passwordVersion: Number(user.passwordVersion || 1),
    mustChangePassword: !!user.mustChangePassword,
    isRootAdmin: !!user.isRootAdmin,
    isActive: !!user.isActive,
  }
}

function extractLoginPayload(responseData) {
  const payload = responseData?.data || responseData || {}

  const token =
    payload.token ||
    payload.accessToken ||
    payload.access_token ||
    payload.jwt ||
    responseData?.token ||
    responseData?.accessToken ||
    responseData?.access_token ||
    ''

  const user =
    payload.user ||
    payload.account ||
    payload.profile ||
    responseData?.user ||
    responseData?.account ||
    null

  return {
    token: s(token),
    user,
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: normalizeUser(readJson(USER_KEY, null)),
    bootstrapped: false,
    loading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    displayName: (state) => state.user?.displayName || '',
    permissionCodes: (state) => uniqueStrings(state.user?.effectivePermissionCodes || []),
    roleCodes: (state) => uniqueStrings(state.user?.roleCodes || []),
    isRootAdmin: (state) => !!state.user?.isRootAdmin,
    mustChangePassword: (state) => !!state.user?.mustChangePassword,

    hasPermission: (state) => {
      const isRootAdmin = !!state.user?.isRootAdmin
      const effective = uniqueStrings(state.user?.effectivePermissionCodes || [])

      return (permissionCode) => {
        if (isRootAdmin) return true
        return effective.includes(up(permissionCode))
      }
    },

    hasAnyPermission: (state) => {
      const isRootAdmin = !!state.user?.isRootAdmin
      const effective = uniqueStrings(state.user?.effectivePermissionCodes || [])

      return (permissionCodes = []) => {
        if (isRootAdmin) return true
        return uniqueStrings(permissionCodes).some((code) => effective.includes(code))
      }
    },

    hasAllPermissions: (state) => {
      const isRootAdmin = !!state.user?.isRootAdmin
      const effective = uniqueStrings(state.user?.effectivePermissionCodes || [])

      return (permissionCodes = []) => {
        if (isRootAdmin) return true
        return uniqueStrings(permissionCodes).every((code) => effective.includes(code))
      }
    },
  },

  actions: {
    setToken(token) {
      this.token = s(token)

      if (this.token) {
        localStorage.setItem(TOKEN_KEY, this.token)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
    },

    setUser(user) {
      this.user = normalizeUser(user)

      if (this.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(this.user))
      } else {
        localStorage.removeItem(USER_KEY)
      }
    },

    clearAuth() {
      this.token = ''
      this.user = null
      this.bootstrapped = true
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },

    async bootstrap() {
      if (!this.token) {
        this.bootstrapped = true
        return
      }

      try {
        const { data } = await getMeApi()
        this.setUser(data?.data || data?.user || null)
      } catch {
        this.clearAuth()
      } finally {
        this.bootstrapped = true
      }
    },

    async login(payload) {
      this.loading = true

      try {
        const { data } = await loginApi(payload)
        const loginPayload = extractLoginPayload(data)

        if (!loginPayload.token) {
          throw new Error('Login succeeded but access token was not returned by backend')
        }

        if (!loginPayload.user) {
          throw new Error('Login succeeded but user profile was not returned by backend')
        }

        this.setToken(loginPayload.token)
        this.setUser(loginPayload.user)
        this.bootstrapped = true

        return data
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.clearAuth()
    },
  },
})