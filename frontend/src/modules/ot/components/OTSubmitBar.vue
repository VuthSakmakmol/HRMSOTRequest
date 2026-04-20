<!-- frontend/src/modules/ot/components/OTSubmitBar.vue -->
<script setup>
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
  <div class="flex flex-wrap gap-2">
    <Button
      label="Submit OT Request"
      icon="pi pi-check"
      size="small"
      :loading="submitting"
      :disabled="disabled"
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