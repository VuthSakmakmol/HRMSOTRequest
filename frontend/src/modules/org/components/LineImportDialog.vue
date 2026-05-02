<!-- frontend/src/modules/org/components/LineImportDialog.vue -->
<script setup>
// frontend/src/modules/org/components/LineImportDialog.vue
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import {
  downloadLineImportSample,
  importLinesExcel,
} from '@/modules/org/line.api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const toast = useToast()

const fileInputRef = ref(null)
const selectedFile = ref(null)
const downloading = ref(false)
const importing = ref(false)

const fileName = computed(() => selectedFile.value?.name || '')
const canImport = computed(() => !!selectedFile.value && !importing.value)

watch(
  () => props.visible,
  (value) => {
    if (!value) resetFile()
  },
)

function resetFile() {
  selectedFile.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function closeDialog() {
  emit('update:visible', false)
}

function triggerChooseFile() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const file = event?.target?.files?.[0] || null

  if (!file) {
    selectedFile.value = null
    return
  }

  const lowerName = String(file.name || '').toLowerCase()
  const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')

  if (!isExcel) {
    selectedFile.value = null
    if (fileInputRef.value) fileInputRef.value.value = ''

    toast.add({
      severity: 'warn',
      summary: 'Invalid file',
      detail: 'Please choose an Excel file: .xlsx or .xls',
      life: 3000,
    })

    return
  }

  selectedFile.value = file
}

function getFilenameFromDisposition(disposition, fallback) {
  const raw = String(disposition || '')

  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])

  const normalMatch = raw.match(/filename="?([^"]+)"?/i)
  if (normalMatch?.[1]) return normalMatch[1]

  return fallback
}

function downloadBlobResponse(response, fallbackName) {
  const blob = response?.data
  const disposition =
    response?.headers?.['content-disposition'] ||
    response?.headers?.['Content-Disposition']

  const filename = getFilenameFromDisposition(disposition, fallbackName)

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
}

async function downloadSample() {
  downloading.value = true

  try {
    const response = await downloadLineImportSample()
    downloadBlobResponse(response, 'line-import-sample.xlsx')

    toast.add({
      severity: 'success',
      summary: 'Sample downloaded',
      detail: 'Line import sample downloaded successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to download line import sample.',
      life: 3500,
    })
  } finally {
    downloading.value = false
  }
}

async function submitImport() {
  if (!selectedFile.value) return

  importing.value = true

  try {
    const response = await importLinesExcel(selectedFile.value)
    const payload = response?.data?.data || response?.data || {}

    toast.add({
      severity: 'success',
      summary: 'Import completed',
      detail: payload?.message || 'Production lines imported successfully.',
      life: 3000,
    })

    emit('success', payload)
    closeDialog()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Import failed',
      detail:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to import production lines.',
      life: 4500,
    })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Import Production Lines"
    :style="{ width: '38rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface-muted)] p-4">
        <div class="mb-2 text-sm font-semibold text-[color:var(--ot-text)]">
          Excel format
        </div>

        <ul class="list-disc space-y-1 pl-5 text-sm text-[color:var(--ot-text-muted)]">
          <li>Download the sample file first.</li>
          <li>Use department code to connect each line to a department.</li>
          <li>Use comma-separated position codes if the line allows specific positions.</li>
          <li>Leave position codes empty if the line allows all positions in the department.</li>
        </ul>
      </div>

      <div class="flex flex-col gap-3 rounded-xl border border-dashed border-[color:var(--ot-border)] p-4">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="onFileChange"
        >

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <div class="text-sm font-medium text-[color:var(--ot-text)]">
              Selected file
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

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          label="Download Sample"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="downloading"
          @click="downloadSample"
        />

        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            @click="closeDialog"
          />
          <Button
            label="Import Lines"
            icon="pi pi-file-import"
            size="small"
            :loading="importing"
            :disabled="!canImport"
            @click="submitImport"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>