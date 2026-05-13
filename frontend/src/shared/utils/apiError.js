// frontend/src/shared/utils/apiError.js

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function s(value) {
  if (value === null || value === undefined) return ''

  if (typeof value === 'string') return value.trim()

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }

  return ''
}

function objectToUsefulMessage(value) {
  if (!isPlainObject(value)) return ''

  return firstNonEmpty(
    value.message,
    value.error,
    value.detail,
    value.reason,
    value.title,
    value.description,
    value.msg,
  )
}

function arrayToUsefulMessage(value) {
  if (!Array.isArray(value) || !value.length) return ''

  const first = value[0]

  if (typeof first === 'string') return s(first)

  if (isPlainObject(first)) {
    return objectToUsefulMessage(first)
  }

  return ''
}

function firstNonEmpty(...values) {
  for (const value of values) {
    let text = ''

    if (Array.isArray(value)) {
      text = arrayToUsefulMessage(value)
    } else if (isPlainObject(value)) {
      text = objectToUsefulMessage(value)
    } else {
      text = s(value)
    }

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
    data.detail,
    data.details?.message,
    data.errors,
    data.issues,
    data.meta?.message,
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
    return getApiErrorMessage(
      error,
      'This record already exists or conflicts with another record.',
    )
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