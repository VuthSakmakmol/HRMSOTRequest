<!-- frontend/src/shared/components/AppLanguageSwitcher.vue -->
<script setup>
// frontend/src/shared/components/AppLanguageSwitcher.vue

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Select from 'primevue/select'

import {
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
} from '@/shared/i18n/languages'
import { setAppLanguage } from '@/shared/i18n'

const { locale, t } = useI18n()

const selectedLanguage = computed({
  get() {
    return normalizeLanguage(locale.value)
  },
  set(value) {
    setAppLanguage(value)
  },
})

const selectedOption = computed(() => {
  return (
    SUPPORTED_LANGUAGES.find((item) => item.code === selectedLanguage.value) ||
    SUPPORTED_LANGUAGES[0]
  )
})
</script>

<template>
  <Select
    v-model="selectedLanguage"
    :options="SUPPORTED_LANGUAGES"
    option-label="label"
    option-value="code"
    class="app-language-switcher"
    :aria-label="t('common.language')"
  >
    <template #value>
      <div class="app-language-switcher__value">
        <span class="app-language-switcher__short">
          {{ selectedOption?.shortLabel || 'EN' }}
        </span>
      </div>
    </template>

    <template #option="{ option }">
      <div class="app-language-switcher__option">
        <span class="app-language-switcher__short">
          {{ option.shortLabel }}
        </span>

        <span class="app-language-switcher__label">
          {{ option.label }}
        </span>
      </div>
    </template>
  </Select>
</template>

<style scoped>
:deep(.app-language-switcher.p-select) {
  width: 5.65rem;
  min-height: 2.1rem;
  border-radius: 999px !important;
  border-color: var(--ot-border, #dbe4ec) !important;
  background: color-mix(in srgb, var(--ot-surface, #ffffff) 92%, transparent) !important;
  box-shadow: var(--ot-shadow-sm, 0 2px 10px rgba(15, 23, 42, 0.05)) !important;
}

:deep(.app-language-switcher.p-select:not(.p-disabled):hover) {
  border-color: color-mix(
    in srgb,
    var(--ot-blue, #81a6c6) 56%,
    var(--ot-border, #dbe4ec)
  ) !important;
}

:deep(.app-language-switcher.p-focus) {
  border-color: var(--ot-blue, #81a6c6) !important;
  box-shadow: 0 0 0 3px rgba(129, 166, 198, 0.16) !important;
}

:deep(.app-language-switcher .p-select-label) {
  display: flex;
  align-items: center;
  padding: 0.38rem 0.52rem 0.38rem 0.7rem !important;
}

:deep(.app-language-switcher .p-select-dropdown) {
  width: 1.55rem !important;
  color: var(--ot-text-muted, #7b8794) !important;
}

.app-language-switcher__value {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.3rem;
}

.app-language-switcher__option {
  display: flex;
  min-width: 8rem;
  align-items: center;
  gap: 0.5rem;
}

.app-language-switcher__short {
  display: inline-flex;
  min-width: 1.65rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-blue, #81a6c6) 14%, transparent);
  padding: 0.16rem 0.32rem;
  color: var(--ot-text, #1f2937);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1;
}

.app-language-switcher__label {
  color: var(--ot-text-soft, #5f6b7a);
  font-size: 0.78rem;
}

:global(.dark) .app-language-switcher__short {
  color: var(--ot-text, #edf3f8);
}
</style>