<!-- frontend/src/shared/components/AppLanguageSwitcher.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Menu from 'primevue/menu'

import {
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
} from '@/shared/i18n/languages'
import { setAppLanguage } from '@/shared/i18n'

const { locale, t } = useI18n()

const menu = ref(null)

const publicFile = (path) => {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

/**
 * Your current files:
 * frontend/public/language-logos/en.jpg
 * frontend/public/language-logos/kh.jpg
 * frontend/public/language-logos/th.jpg
 *
 * For PNG, just change .jpg to .png here.
 */
const LANGUAGE_LOGOS = {
  en: publicFile('/language-logos/en.jpg'),
  km: publicFile('/language-logos/kh.jpg'),
  kh: publicFile('/language-logos/kh.jpg'),
  th: publicFile('/language-logos/th.jpg'),
}

const selectedLanguage = computed(() => normalizeLanguage(locale.value))

const selectedOption = computed(() => {
  return (
    SUPPORTED_LANGUAGES.find((item) => {
      const rawCode = String(item.code || '').trim().toLowerCase()
      return (
        rawCode === String(locale.value || '').trim().toLowerCase() ||
        normalizeLanguage(rawCode) === selectedLanguage.value
      )
    }) || SUPPORTED_LANGUAGES[0]
  )
})

const getLanguageLogo = (code) => {
  const rawCode = String(code || '').trim().toLowerCase()
  const normalizedCode = normalizeLanguage(rawCode)

  return (
    LANGUAGE_LOGOS[rawCode] ||
    LANGUAGE_LOGOS[normalizedCode] ||
    LANGUAGE_LOGOS.en
  )
}

const selectedLogo = computed(() => getLanguageLogo(selectedOption.value?.code))

const languageItems = computed(() => {
  return SUPPORTED_LANGUAGES.map((item) => ({
    ...item,
    logo: getLanguageLogo(item.code),
  }))
})

function toggleMenu(event) {
  menu.value?.toggle(event)
}

function selectLanguage(code) {
  setAppLanguage(code)
  menu.value?.hide?.()
}
</script>

<template>
  <div class="app-language-switcher">
    <button
      type="button"
      class="app-language-switcher__trigger"
      :title="selectedOption?.label || t('common.language')"
      :aria-label="t('common.language')"
      @click="toggleMenu"
    >
      <img
        class="app-language-switcher__logo"
        :src="selectedLogo"
        :alt="selectedOption?.label || selectedLanguage"
      />
    </button>

    <Menu
      ref="menu"
      :model="languageItems"
      popup
      class="app-language-switcher-menu"
    >
      <template #item="{ item }">
        <button
          type="button"
          class="app-language-switcher-menu__item"
          :class="{
            'is-active':
              normalizeLanguage(item.code) === selectedLanguage ||
              item.code === locale,
          }"
          :title="item.label"
          :aria-label="item.label"
          @click="selectLanguage(item.code)"
        >
          <img
            class="app-language-switcher-menu__logo"
            :src="item.logo"
            :alt="item.label"
          />
        </button>
      </template>
    </Menu>
  </div>
</template>

<style scoped>
.app-language-switcher {
  display: inline-flex;
  width: auto;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
}

.app-language-switcher__trigger {
  display: inline-flex;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--ot-border, #dbe4ec);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-surface, #ffffff) 92%, transparent);
  box-shadow: var(--ot-shadow-sm, 0 2px 10px rgba(15, 23, 42, 0.05));
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.app-language-switcher__trigger:hover {
  border-color: color-mix(
    in srgb,
    var(--ot-blue, #81a6c6) 56%,
    var(--ot-border, #dbe4ec)
  );
  background: color-mix(in srgb, var(--ot-blue, #81a6c6) 7%, var(--ot-surface, #ffffff));
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.app-language-switcher__trigger:active {
  transform: translateY(1px);
}

.app-language-switcher__trigger:focus-visible {
  outline: none;
  border-color: var(--ot-blue, #81a6c6);
  box-shadow: 0 0 0 3px rgba(129, 166, 198, 0.16);
}

.app-language-switcher__logo,
.app-language-switcher-menu__logo {
  display: block;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: 999px;
  object-fit: cover;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.06),
    0 2px 8px rgba(15, 23, 42, 0.08);
}

:global(.app-language-switcher-menu) {
  width: auto !important;
  min-width: 2.85rem !important;
  padding: 0.28rem !important;
  border: 1px solid var(--ot-border, #dbe4ec) !important;
  border-radius: 999px !important;
  background: var(--ot-surface, #ffffff) !important;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14) !important;
}

:global(.app-language-switcher-menu .p-menu-list) {
  display: grid !important;
  gap: 0.18rem !important;
  padding: 0 !important;
}

:global(.app-language-switcher-menu .p-menu-item-content) {
  border-radius: 999px !important;
}

:global(.app-language-switcher-menu .p-menu-item-link) {
  padding: 0 !important;
}

.app-language-switcher-menu__item {
  display: inline-flex;
  width: 2.2rem;
  height: 2.2rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.app-language-switcher-menu__item:hover,
.app-language-switcher-menu__item.is-active {
  background: color-mix(in srgb, var(--ot-blue, #81a6c6) 14%, transparent);
}

.app-language-switcher-menu__item:active {
  transform: translateY(1px);
}

:global(.dark) .app-language-switcher__logo,
:global(.dark) .app-language-switcher-menu__logo {
  box-shadow:
    0 0 0 1px rgba(237, 243, 248, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.25);
}
</style>