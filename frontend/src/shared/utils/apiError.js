// frontend/src/shared/utils/apiError.js

function s(value) {
  return String(value ?? '').trim()
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = s(value)
    if (text) return text
  }
  return ''
}

export function getApiErrorPayload(error) {
  return error?.response?.data || {}
}

export function getApiErrorStatus(error) {
  return Number(error?.response?.status || 0)
}

export function getApiMessageKey(error) {
  const data = getApiErrorPayload(error)

  return firstNonEmpty(
    data.messageKey,
    data.errorKey,
    data.code,
    data.meta?.messageKey,
  )
}

export function getRequiredPermission(error) {
  const data = getApiErrorPayload(error)

  return firstNonEmpty(
    data.requiredPermission,
    data.requiredPermissionCode,
    data.permissionCode,
    data.meta?.requiredPermission,
    data.meta?.requiredPermissionCode,
  ).toUpperCase()
}

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const data = getApiErrorPayload(error)

  return firstNonEmpty(
    data.message,
    data.error,
    data.details?.message,
    error?.message,
    fallback,
  )
}

export function buildPermissionAwareMessage(subject, error, fallback) {
  const status = getApiErrorStatus(error)
  const permission = getRequiredPermission(error)
  const cleanSubject = s(subject) || 'This data'

  if (status === 403 && permission) {
    return `${cleanSubject} cannot be loaded because your account is missing permission: ${permission}.`
  }

  if (status === 403) {
    return `${cleanSubject} cannot be loaded because your account does not have the required permission.`
  }

  return getApiErrorMessage(error, fallback)
}

export function buildSaveErrorMessage(error, fallback = 'Save failed') {
  const status = getApiErrorStatus(error)

  if (status === 400) {
    return getApiErrorMessage(error, 'Please check the required fields.')
  }

  if (status === 403) {
    const permission = getRequiredPermission(error)
    return permission
      ? `You cannot save this record because your account is missing permission: ${permission}.`
      : 'You do not have permission to save this record.'
  }

  if (status === 409) {
    return getApiErrorMessage(error, 'This record already exists or conflicts with another record.')
  }

  return getApiErrorMessage(error, fallback)
}

export function isAuthError(error) {
  return getApiErrorStatus(error) === 401
}

export function isForbiddenError(error) {
  return getApiErrorStatus(error) === 403
}

export function isValidationError(error) {
  return getApiErrorStatus(error) === 400
}