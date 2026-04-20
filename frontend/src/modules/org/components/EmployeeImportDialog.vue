<!-- frontend/src/modules/org/components/EmployeeImportDialog.vue -->
<script setup>
// frontend/src/modules/org/components/EmployeeImportDialog.vue
import { computed, ref, watch } from 'vue'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import {
  downloadEmployeeImportSample,
  importEmployeesExcel,
} from '@/modules/org/employee.api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const fileInputRef = ref(null)
const selectedFile = ref(null)
const downloading = ref(false)
const importing = ref(false)

const fileName = computed(() => selectedFile.value?.name || '')

watch(
  () => props.visible,
  (value) => {
    if (!value) {
      selectedFile.value = null
      if (fileInputRef.value) fileInputRef.value.value = ''
    }
  },
)

function closeDialog() {
  emit('update:visible', false)
}

function triggerChooseFile() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  selectedFile.value = event?.target?.files?.[0] || null
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

async function handleDownloadSample() {
  downloading.value = true
  try {
    const res = await downloadEmployeeImportSample()
    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, 'employee-import-sample.xlsx')
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  try {
    const res = await importEmployeesExcel(selectedFile.value)
    emit('success', normalizePayload(res))
    closeDialog()
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Import Employee Excel"
    :style="{ width: '34rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-4">
        <div class="text-sm font-semibold text-[color:var(--ot-text)]">
          Import guide
        </div>
        <div class="mt-2 space-y-1 text-sm text-[color:var(--ot-text-muted)]">
          <div>1. Download the sample file.</div>
          <div>2. Fill your employee data in the same format.</div>
          <div>3. Choose the completed Excel file from your computer.</div>
          <div>4. Click Import to upload and process it.</div>
        </div>

        <div class="mt-4">
          <Button
            label="Download Sample"
            icon="pi pi-download"
            outlined
            severity="secondary"
            size="small"
            :loading="downloading"
            @click="handleDownloadSample"
          />
        </div>
      </div>

      <div class="rounded-2xl border border-dashed border-[color:var(--ot-border)] px-4 py-4">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onFileChange"
        >

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="text-sm font-medium text-[color:var(--ot-text)]">
              Excel file
            </div>
            <div class="mt-1 truncate text-sm text-[color:var(--ot-text-muted)]">
              {{ fileName || 'No file selected' }}
            </div>
          </div>

          <Button
            label="Choose File"
            icon="pi pi-upload"
            severity="secondary"
            outlined
            size="small"
            @click="triggerChooseFile"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancel"
          text
          size="small"
          @click="closeDialog"
        />
        <Button
          label="Import"
          icon="pi pi-check"
          size="small"
          :disabled="!selectedFile"
          :loading="importing"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>