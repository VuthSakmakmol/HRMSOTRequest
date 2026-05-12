// frontend/src/shared/i18n/index.js
import { createI18n } from 'vue-i18n'

import en from './messages/en'
import km from './messages/km'
import th from './messages/th'
import { getSavedLanguage, normalizeLanguage, saveLanguage } from './languages'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getSavedLanguage(),
  fallbackLocale: 'en',
  messages: {
    en,
    km,
    th,
  },
})

function applyDocumentLanguage(language) {
  const normalized = normalizeLanguage(language)

  document.documentElement.lang = normalized
  document.documentElement.setAttribute('data-app-lang', normalized)

  return normalized
}

export function setAppLanguage(language) {
  const normalized = normalizeLanguage(language)

  i18n.global.locale.value = normalized
  saveLanguage(normalized)
  applyDocumentLanguage(normalized)

  return normalized
}

export function getAppLanguage() {
  return normalizeLanguage(i18n.global.locale.value)
}

export function initAppLanguage() {
  return setAppLanguage(getSavedLanguage())
}

export default i18n