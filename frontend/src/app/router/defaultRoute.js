// frontend/src/app/router/defaultRoute.js

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

function collectPermissionCodes(auth) {
  const user = auth?.user || {}

  return uniqueStrings([
    ...(Array.isArray(auth?.permissionCodes) ? auth.permissionCodes : []),
    ...(Array.isArray(auth?.effectivePermissionCodes)
      ? auth.effectivePermissionCodes
      : []),
    ...(Array.isArray(user?.effectivePermissionCodes)
      ? user.effectivePermissionCodes
      : []),
    ...(Array.isArray(user?.directPermissionCodes)
      ? user.directPermissionCodes
      : []),
  ])
}

export const DEFAULT_HOME_PATHS = Object.freeze({
  otRequests: '/ot/requests',
  otApprovals: '/ot/approvals',
  otAcknowledgements: '/ot/acknowledgements',
  forbidden: '/403',
})

const HOME_CANDIDATES = Object.freeze([
  {
    path: DEFAULT_HOME_PATHS.otRequests,
    permissions: ['OT_REQUEST_VIEW', 'OT_REQUEST_CREATE', 'OT_REQUEST_UPDATE'],
  },
  {
    path: DEFAULT_HOME_PATHS.otApprovals,
    permissions: ['OT_REQUEST_APPROVE'],
  },
  {
    path: DEFAULT_HOME_PATHS.otAcknowledgements,
    permissions: ['OT_REQUEST_ACKNOWLEDGE'],
  },
])

export function canOpenByAnyPermission(auth, permissions = []) {
  const required = uniqueStrings(permissions)

  if (!required.length) return true
  if (auth?.isRootAdmin) return true

  if (typeof auth?.hasAnyPermission === 'function') {
    return auth.hasAnyPermission(required)
  }

  const permissionCodes = collectPermissionCodes(auth)
  return required.some((permission) => permissionCodes.includes(permission))
}

export function resolveDefaultHomePath(auth, fallback = DEFAULT_HOME_PATHS.forbidden) {
  const candidate = HOME_CANDIDATES.find((item) => {
    return canOpenByAnyPermission(auth, item.permissions)
  })

  return candidate?.path || fallback
}

export function safeRedirectPath(value, auth, fallback = '') {
  const defaultPath = fallback || resolveDefaultHomePath(auth)
  const path = s(value)

  if (!path) return defaultPath
  if (!path.startsWith('/')) return defaultPath
  if (path.startsWith('//')) return defaultPath
  if (path === '/') return defaultPath
  if (path === '/dashboard') return defaultPath
  if (path.startsWith('/login')) return defaultPath

  return path
}
