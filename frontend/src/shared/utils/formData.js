// frontend/src/shared/utils/formData.js

export function toFileFormData(input, fieldName = 'file') {
  if (input instanceof FormData) {
    return input
  }

  const formData = new FormData()

  if (input) {
    formData.append(fieldName, input)
  }

  return formData
}