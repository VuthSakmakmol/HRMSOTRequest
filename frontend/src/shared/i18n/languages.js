// frontend/src/shared/i18n/languages.js
export const LANGUAGE_KEY = 'ot_language'

export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    label: 'English',
    shortLabel: 'EN',
  },
  {
    code: 'km',
    label: 'ភាសាខ្មែរ',
    shortLabel: 'ខ្មែរ',
  },
  {
    code: 'th',
    label: 'ภาษาไทย',
    shortLabel: 'TH',
  },
]

export function normalizeLanguage(value) {
  const code = String(value || '').trim().toLowerCase()
  return SUPPORTED_LANGUAGES.some((item) => item.code === code) ? code : 'en'
}

export function getSavedLanguage() {
  return normalizeLanguage(localStorage.getItem(LANGUAGE_KEY) || 'en')
}

export function saveLanguage(language) {
  localStorage.setItem(LANGUAGE_KEY, normalizeLanguage(language))
}