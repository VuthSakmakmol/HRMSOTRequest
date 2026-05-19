// frontend/src/shared/utils/apiError.js

import { i18n } from '@/shared/i18n'

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

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = s(value)

    if (text) return text
  }

  return ''
}

function normalizeParams(value) {
  return isPlainObject(value) ? value : {}
}

function globalT(key, params = {}) {
  const cleanKey = s(key)

  if (!cleanKey) return ''

  try {
    const composer = i18n?.global

    if (composer?.te?.(cleanKey)) {
      return composer.t(cleanKey, normalizeParams(params))
    }

    const translated = composer?.t?.(cleanKey, normalizeParams(params))

    if (translated && translated !== cleanKey) {
      return translated
    }
  } catch (_) {
    return ''
  }

  return ''
}

function payloadError(data) {
  return isPlainObject(data?.error) ? data.error : {}
}

function firstIssue(data) {
  if (Array.isArray(data?.issues) && data.issues.length) return data.issues[0]
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors[0]

  const nested = payloadError(data)

  if (Array.isArray(nested?.issues) && nested.issues.length) return nested.issues[0]
  if (Array.isArray(nested?.errors) && nested.errors.length) return nested.errors[0]

  return null
}

function objectMessage(value) {
  if (!isPlainObject(value)) return ''

  return firstNonEmpty(
    value.message,
    value.detail,
    value.reason,
    value.title,
    value.description,
    value.msg,
  )
}

function translatedFromObject(value) {
  if (!isPlainObject(value)) return ''

  const key = firstNonEmpty(
    value.messageKey,
    value.errorKey,
    value.meta?.messageKey,
  )

  const translated = globalT(key, value.params || value.meta?.params || {})

  if (translated) return translated

  return objectMessage(value)
}

export function getApiErrorPayload(error) {
  return error?.response?.data || {}
}

export function getApiErrorStatus(error) {
  return Number(error?.response?.status || 0)
}

export function getApiMessageKey(error) {
  const data = getApiErrorPayload(error)
  const nested = payloadError(data)
  const issue = firstIssue(data)

  return firstNonEmpty(
    issue?.messageKey,
    issue?.errorKey,
    data.messageKey,
    data.errorKey,
    nested.messageKey,
    nested.errorKey,
    data.meta?.messageKey,
    nested.meta?.messageKey,
    data.code,
    nested.code,
  )
}

export function getRequiredPermission(error) {
  const data = getApiErrorPayload(error)
  const nested = payloadError(data)

  return firstNonEmpty(
    data.requiredPermission,
    data.requiredPermissionCode,
    data.permissionCode,
    nested.requiredPermission,
    nested.requiredPermissionCode,
    nested.permissionCode,
    data.params?.requiredPermission,
    data.params?.requiredPermissionCode,
    nested.params?.requiredPermission,
    nested.params?.requiredPermissionCode,
    data.meta?.requiredPermission,
    data.meta?.requiredPermissionCode,
    nested.meta?.requiredPermission,
    nested.meta?.requiredPermissionCode,
  ).toUpperCase()
}

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const data = getApiErrorPayload(error)
  const nested = payloadError(data)
  const issue = firstIssue(data)

  const issueMessage = translatedFromObject(issue)

  if (issueMessage) return issueMessage

  const messageKey = firstNonEmpty(
    data.messageKey,
    data.errorKey,
    nested.messageKey,
    nested.errorKey,
    data.meta?.messageKey,
    nested.meta?.messageKey,
  )

  const translated = globalT(messageKey, data.params || nested.params || {})

  if (translated) return translated

  return firstNonEmpty(
    data.message,
    nested.message,
    data.detail,
    nested.detail,
    data.details?.message,
    nested.details?.message,
    objectMessage(data.meta),
    objectMessage(nested.meta),
    error?.message,
    fallback,
  )
}

export function buildPermissionAwareMessage(subject, error, fallback) {
  const status = getApiErrorStatus(error)
  const permission = getRequiredPermission(error)
  const cleanSubject = s(subject) || globalT('common.thisData') || 'This data'

  if (status === 403 && permission) {
    return globalT('common.error.missingPermissionWithSubject', {
      subject: cleanSubject,
      permission,
    }) || `${cleanSubject} cannot be loaded because your account is missing permission: ${permission}.`
  }

  if (status === 403) {
    return globalT('common.error.missingPermissionForSubject', {
      subject: cleanSubject,
    }) || `${cleanSubject} cannot be loaded because your account does not have the required permission.`
  }

  return getApiErrorMessage(error, fallback)
}

export function buildSaveErrorMessage(error, fallback = 'Save failed') {
  const status = getApiErrorStatus(error)

  if (status === 400) {
    return getApiErrorMessage(
      error,
      globalT('common.error.checkRequiredFields') || 'Please check the required fields.',
    )
  }

  if (status === 403) {
    const permission = getRequiredPermission(error)

    if (permission) {
      return globalT('common.error.saveMissingPermission', {
        permission,
      }) || `You cannot save this record because your account is missing permission: ${permission}.`
    }

    return globalT('common.error.saveNoPermission') || 'You do not have permission to save this record.'
  }

  if (status === 409) {
    return getApiErrorMessage(
      error,
      globalT('common.error.duplicateOrConflict') || 'This record already exists or conflicts with another record.',
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