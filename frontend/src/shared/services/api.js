// frontend/src/shared/services/api.js
import axios from 'axios'

const ACCESS_TOKEN_KEY = 'ot_access_token'
const AUTH_USER_KEY = 'ot_auth_user'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:4112/api/v1' : '/api/v1')

// Local development:
// http://localhost:4112/api/v1
//
// Production on droplet with Nginx port 8081:
// /api/v1

function isBrowser() {
  return typeof window !== 'undefined'
}

export function getAccessToken() {
  if (!isBrowser()) return ''
  return String(localStorage.getItem(ACCESS_TOKEN_KEY) || '').trim()
}

export function setAccessToken(token) {
  if (!isBrowser()) return

  const cleanToken = String(token || '').trim()

  if (cleanToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, cleanToken)
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

export function clearAuthSession() {
  if (!isBrowser()) return

  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)

  window.dispatchEvent(new CustomEvent('ot:auth:cleared'))
}

function redirectToLogin() {
  if (!isBrowser()) return

  const currentPath = `${window.location.pathname}${window.location.search}`
  const isLoginPage = window.location.pathname === '/login'

  if (isLoginPage) return

  const redirect = encodeURIComponent(currentPath || '/dashboard')
  window.location.href = `/login?redirect=${redirect}`
}

const api = axios.create({
  baseURL: API_BASE_URL,
  // Axios uses 0 to allow long-running operations to finish without a client timeout.
  timeout: 0,
  headers: {
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()

  config.headers = config.headers || {}

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = Number(error?.response?.status || 0)

    if (status === 401) {
      clearAuthSession()
      redirectToLogin()
    }

    return Promise.reject(error)
  },
)

export default api
