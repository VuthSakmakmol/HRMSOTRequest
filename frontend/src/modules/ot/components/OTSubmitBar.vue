<!-- frontend/src/modules/ot/components/OTSubmitBar.vue -->
<script setup>
// frontend/src/modules/ot/components/OTSubmitBar.vue

import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'

const props = defineProps({
  submitLabel: {
    type: String,
    default: '',
  },

  submitting: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['submit', 'back'])

const { t } = useI18n()
</script>

<template>
  <div class="ot-submit-bar">
    <Button
      :label="props.submitLabel || t('ot.requests.create.submitRequest')"
      icon="pi pi-check"
      size="small"
      :loading="submitting"
      :disabled="disabled"
      class="ot-submit-button"
      @click="emit('submit')"
    />

    <Button
      :label="t('common.back')"
      icon="pi pi-arrow-left"
      severity="secondary"
      outlined
      size="small"
      @click="emit('back')"
    />
  </div>
</template>

<style scoped>
.ot-submit-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

:deep(.ot-submit-button .p-button-label),
:deep(.p-button .p-button-label) {
  font-weight: 500 !important;
}
</style>