// frontend/src/modules/auth/auth.store.js
import { defineStore } from 'pinia'
import { loginApi, getMeApi } from './auth.api'
import {
  getAccessToken,
  setAccessToken,
  clearAuthSession,
} from '@/shared/services/api'

const USER_KEY = 'ot_auth_user'

function isBrowser() {
  return typeof window !== 'undefined'
}

function readJson(key, fallback = null) {
  if (!isBrowser()) return fallback

  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  if (!isBrowser()) return

  if (value) {
    localStorage.setItem(key, JSON.stringify(value))
  } else {
    localStorage.removeItem(key)
  }
}

function s(value) {
  return String(value ?? '').trim()
}

function up(value) {
  return s(value).toUpperCase()
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map(up)
        .filter(Boolean),
    ),
  ]
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

function getRoleCodes(user, roles) {
  return uniqueStrings(
    user?.roleCodes ||
      roles.map((role) => role.code) ||
      [],
  )
}

function normalizeUser(user) {
  if (!user) return null

  const roles = normalizeRoles(user.roles || user.roleCodes || [])
  const roleCodes = getRoleCodes(user, roles)
  const effectivePermissionCodes = uniqueStrings(user.effectivePermissionCodes || [])
  const directPermissionCodes = uniqueStrings(user.directPermissionCodes || [])
  const isRootAdmin = !!user.isRootAdmin || roleCodes.includes('ROOT_ADMIN')

  return {
    id: s(user.id || user._id || user.accountId),
    accountId: s(user.accountId || user.id || user._id),
    loginId: s(user.loginId).toLowerCase(),
    displayName: s(user.displayName || user.name || user.loginId),
    employeeId: user.employeeId ? s(user.employeeId) : null,

    roleIds: Array.isArray(user.roleIds)
      ? user.roleIds.map((value) => s(value)).filter(Boolean)
      : [],

    roles,
    roleCodes,
    directPermissionCodes,
    effectivePermissionCodes,

    passwordVersion: Number(user.passwordVersion || 1),
    mustChangePassword: !!user.mustChangePassword,
    isRootAdmin,
    isActive: user.isActive !== false,
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

function extractMePayload(responseData) {
  const payload = responseData?.data || responseData || {}

  return (
    payload.user ||
    payload.account ||
    payload.profile ||
    payload
  )
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getAccessToken(),
    user: normalizeUser(readJson(USER_KEY, null)),
    bootstrapped: false,
    loading: false,
    bootstrapLoading: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    displayName: (state) => state.user?.displayName || '',
    loginId: (state) => state.user?.loginId || '',
    employeeId: (state) => state.user?.employeeId || null,

    roleCodes: (state) => uniqueStrings(state.user?.roleCodes || []),
    permissionCodes: (state) => uniqueStrings(state.user?.effectivePermissionCodes || []),

    isRootAdmin: (state) => !!state.user?.isRootAdmin,
    mustChangePassword: (state) => !!state.user?.mustChangePassword,

    hasRole: (state) => {
      const roleCodes = uniqueStrings(state.user?.roleCodes || [])

      return (roleCode) => {
        return roleCodes.includes(up(roleCode))
      }
    },

    hasAnyRole: (state) => {
      const roleCodes = uniqueStrings(state.user?.roleCodes || [])

      return (requiredRoles = []) => {
        return uniqueStrings(requiredRoles).some((roleCode) => roleCodes.includes(roleCode))
      }
    },

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

        const required = uniqueStrings(permissionCodes)
        if (!required.length) return true

        return required.some((code) => effective.includes(code))
      }
    },

    hasAllPermissions: (state) => {
      const isRootAdmin = !!state.user?.isRootAdmin
      const effective = uniqueStrings(state.user?.effectivePermissionCodes || [])

      return (permissionCodes = []) => {
        if (isRootAdmin) return true

        const required = uniqueStrings(permissionCodes)
        if (!required.length) return true

        return required.every((code) => effective.includes(code))
      }
    },
  },

  actions: {
    setToken(token) {
      this.token = s(token)
      setAccessToken(this.token)
    },

    setUser(user) {
      this.user = normalizeUser(user)
      writeJson(USER_KEY, this.user)
    },

    clearAuth() {
      this.token = ''
      this.user = null
      this.bootstrapped = true
      this.loading = false
      this.bootstrapLoading = false
      clearAuthSession()
    },

    async bootstrap(force = false) {
      if (this.bootstrapped && !force) return

      if (!this.token) {
        this.bootstrapped = true
        return
      }

      this.bootstrapLoading = true

      try {
        const { data } = await getMeApi()
        const user = extractMePayload(data)

        this.setUser(user)
      } catch {
        this.clearAuth()
      } finally {
        this.bootstrapped = true
        this.bootstrapLoading = false
      }
    },

    async refreshMe() {
      if (!this.token) return null

      const { data } = await getMeApi()
      const user = extractMePayload(data)

      this.setUser(user)

      return this.user
    },

    async login(payload) {
      this.loading = true

      try {
        const { data } = await loginApi(payload)
        const loginPayload = extractLoginPayload(data)

        if (!loginPayload.token) {
          throw new Error('Login succeeded but access token was not returned by backend.')
        }

        if (!loginPayload.user) {
          throw new Error('Login succeeded but user profile was not returned by backend.')
        }

        this.setToken(loginPayload.token)
        this.setUser(loginPayload.user)
        this.bootstrapped = true

        return {
          raw: data,
          user: this.user,
          token: this.token,
        }
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.clearAuth()
    },
  },
})