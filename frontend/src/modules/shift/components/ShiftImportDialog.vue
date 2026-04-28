<!-- frontend/src/modules/shift/components/ShiftImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

import {
  downloadShiftImportSample,
  importShiftsExcel,
} from '@/modules/shift/shift.api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const toast = useToast()

const selectedFile = ref(null)
const fileInputRef = ref(null)
const downloading = ref(false)
const importing = ref(false)

const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const canImport = computed(() => !!selectedFile.value && !importing.value)

function reset() {
  selectedFile.value = null

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function onFileChange(event) {
  selectedFile.value = event?.target?.files?.[0] || null
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
    const res = await downloadShiftImportSample()

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, 'shift-import-sample.xlsx')
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to download shift sample file',
      life: 3500,
    })
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value) return

  importing.value = true

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const res = await importShiftsExcel(formData)

    emit('success', res?.data || {})
    localVisible.value = false
    reset()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Import failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to import shift excel',
      life: 4000,
    })
  } finally {
    importing.value = false
  }
}

watch(
  () => props.visible,
  (value) => {
    if (!value) reset()
  },
)
</script>

<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    header="Import Shifts"
    :style="{ width: '34rem', maxWidth: '96vw' }"
  >
    <div class="space-y-4">
      <div
        class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] p-4"
      >
        <h3 class="text-sm font-semibold text-[color:var(--ot-text)]">
          Excel import format
        </h3>

        <p class="mt-2 text-sm leading-6 text-[color:var(--ot-text-muted)]">
          Download the sample file, fill in shift records, then upload the completed Excel file.
          Existing shift codes will be updated. New shift codes will be created.
        </p>

        <ul class="mt-3 list-disc space-y-1 pl-5 text-xs text-[color:var(--ot-text-muted)]">
          <li>Type must be DAY or NIGHT.</li>
          <li>Time fields must use HH:mm format.</li>
          <li>DAY shift cannot cross midnight.</li>
          <li>NIGHT shift must cross midnight.</li>
        </ul>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium text-[color:var(--ot-text)]">
          Select Excel File
        </label>

        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls"
          class="block w-full rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-sm text-[color:var(--ot-text)]"
          @change="onFileChange"
        />

        <p
          v-if="selectedFile"
          class="text-xs text-[color:var(--ot-text-muted)]"
        >
          Selected: {{ selectedFile.name }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <Button
          label="Download Sample"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="downloading"
          @click="handleDownloadSample"
        />

        <Button
          label="Cancel"
          text
          size="small"
          @click="localVisible = false"
        />

        <Button
          label="Import"
          icon="pi pi-upload"
          size="small"
          :loading="importing"
          :disabled="!canImport"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>