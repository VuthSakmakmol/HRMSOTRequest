<!-- frontend/src/modules/ot/components/OTSubmitBar.vue -->
<script setup>
// frontend/src/modules/ot/components/OTSubmitBar.vue

import Button from 'primevue/button'

defineProps({
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
</script>

<template>
  <div class="ot-submit-bar">
    <Button
      label="Submit OT Request"
      icon="pi pi-check"
      size="small"
      :loading="submitting"
      :disabled="disabled"
      class="ot-submit-button"
      @click="emit('submit')"
    />

    <Button
      label="Back"
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