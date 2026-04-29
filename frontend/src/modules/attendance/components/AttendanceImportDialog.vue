<!-- frontend/src/modules/attendance/components/AttendanceImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'

import {
  downloadAttendanceImportSample,
  importAttendanceExcel,
} from '@/modules/attendance/attendance.api'

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
const attendanceDate = ref(null)
const downloading = ref(false)
const importing = ref(false)

const fileName = computed(() => selectedFile.value?.name || '')

watch(
  () => props.visible,
  (value) => {
    if (!value) {
      resetForm()
    }
  },
)

function resetForm() {
  selectedFile.value = null
  attendanceDate.value = null

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function closeDialog() {
  if (importing.value) return
  emit('update:visible', false)
}

function triggerChooseFile() {
  if (importing.value) return
  fileInputRef.value?.click()
}

function formatDateForApi(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function validateFile(file) {
  if (!file) return 'Please choose an Excel file.'

  const fileName = String(file.name || '').toLowerCase()
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

  if (!isExcel) {
    return 'Please upload Excel file only: .xlsx or .xls.'
  }

  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return 'File size must not exceed 10 MB.'
  }

  return ''
}

function onFileChange(event) {
  const file = event?.target?.files?.[0] || null
  const message = validateFile(file)

  if (message) {
    selectedFile.value = null

    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }

    toast.add({
      severity: 'warn',
      summary: 'Invalid file',
      detail: message,
      life: 3000,
    })
    return
  }

  selectedFile.value = file
}

function saveBlobFile(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename || 'attendance-import-sample.xlsx'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.URL.revokeObjectURL(url)
}

async function handleDownloadSample() {
  if (downloading.value) return

  downloading.value = true

  try {
    const response = await downloadAttendanceImportSample()

    const contentDisposition = String(response?.headers?.['content-disposition'] || '')
    const match = contentDisposition.match(/filename="?([^"]+)"?/i)
    const filename = match?.[1] || 'attendance-import-sample.xlsx'

    const blob = new Blob([response.data], {
      type:
        response?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    saveBlobFile(blob, filename)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to download sample file.',
      life: 3500,
    })
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (importing.value) return

  const selectedDate = formatDateForApi(attendanceDate.value)

  if (!selectedDate) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please select attendance date.',
      life: 3000,
    })
    return
  }

  const fileMessage = validateFile(selectedFile.value)

  if (fileMessage) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: fileMessage,
      life: 3000,
    })
    return
  }

  importing.value = true

  try {
    const formData = new FormData()

    formData.append('file', selectedFile.value)
    formData.append('sourceType', 'EXCEL')
    formData.append('attendanceDate', selectedDate)

    const response = await importAttendanceExcel(formData)

    const payload = response?.data?.data || response?.data || null
    const importInfo = payload?.import || null

    toast.add({
      severity: 'success',
      summary: 'Import completed',
      detail:
        importInfo?.status === 'PARTIAL_SUCCESS'
          ? 'Attendance imported with some skipped or invalid rows.'
          : 'Attendance imported successfully.',
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
        error?.message ||
        'Failed to import attendance file.',
      life: 4000,
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
    header="Import Attendance"
    :style="{ width: '34rem', maxWidth: '96vw' }"
    :closable="!importing"
    :dismissableMask="!importing"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-4">
        <div class="text-sm font-semibold text-[color:var(--ot-text)]">
          Import guide
        </div>

        <div class="mt-2 space-y-1 text-sm text-[color:var(--ot-text-muted)]">
          <div>1. Select attendance date.</div>
          <div>2. Download the sample file.</div>
          <div>3. Fill Employee ID, Clock In, and Clock Out.</div>
          <div>4. Choose the completed Excel file and click Import.</div>
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

      <div class="space-y-2">
        <label class="text-sm font-medium text-[color:var(--ot-text)]">
          Attendance Date
        </label>

        <DatePicker
          v-model="attendanceDate"
          showIcon
          fluid
          dateFormat="yy-mm-dd"
          inputClass="w-full"
          placeholder="Select attendance date"
        />
      </div>

      <div class="rounded-2xl border border-dashed border-[color:var(--ot-border)] px-4 py-4">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls"
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
            :disabled="importing"
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
          :disabled="importing"
          @click="closeDialog"
        />

        <Button
          label="Import"
          icon="pi pi-check"
          size="small"
          :disabled="!selectedFile || !attendanceDate"
          :loading="importing"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>