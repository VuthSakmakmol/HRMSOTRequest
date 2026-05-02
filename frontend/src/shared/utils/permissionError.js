// frontend/src/shared/utils/permissionError.js

export function getRequiredPermission(error) {
  const data = error?.response?.data || {}

  return String(
    data?.requiredPermission ||
      data?.requiredPermissionCode ||
      data?.permissionCode ||
      data?.meta?.requiredPermission ||
      '',
  ).trim()
}

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  const data = error?.response?.data || {}

  return (
    data?.message ||
    data?.error ||
    error?.message ||
    fallback
  )
}

export function buildPermissionAwareMessage(subject, error, fallback) {
  const status = Number(error?.response?.status || 0)
  const permission = getRequiredPermission(error)

  if (status === 403 && permission) {
    return `${subject} cannot be loaded because your account is missing permission: ${permission}.`
  }

  if (status === 403) {
    return `${subject} cannot be loaded because your account does not have the required permission.`
  }

  return getApiErrorMessage(error, fallback)
}