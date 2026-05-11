<!-- frontend/src/shared/components/AppLanguageSwitcher.vue -->
<script setup>
import { computed } from 'vue'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'

import {
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
} from '@/shared/i18n/languages'
import { setAppLanguage } from '@/shared/i18n'

const { locale } = useI18n()

const selectedLanguage = computed({
  get() {
    return normalizeLanguage(locale.value)
  },
  set(value) {
    setAppLanguage(value)
  },
})
</script>

<template>
  <Select
    v-model="selectedLanguage"
    :options="SUPPORTED_LANGUAGES"
    option-label="shortLabel"
    option-value="code"
    class="app-language-switcher"
    aria-label="Language"
  >
    <template #value="{ value }">
      <span class="text-xs font-bold">
        {{ SUPPORTED_LANGUAGES.find((item) => item.code === value)?.shortLabel || 'EN' }}
      </span>
    </template>

    <template #option="{ option }">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold">{{ option.shortLabel }}</span>
        <span class="text-xs">{{ option.label }}</span>
      </div>
    </template>
  </Select>
</template>

<style scoped>
:deep(.app-language-switcher.p-select) {
  width: 5.6rem;
  min-height: 2.15rem;
  border-radius: 999px !important;
}

:deep(.app-language-switcher .p-select-label) {
  padding: 0.42rem 0.6rem !important;
}

:deep(.app-language-switcher .p-select-dropdown) {
  width: 1.7rem !important;
}
</style>