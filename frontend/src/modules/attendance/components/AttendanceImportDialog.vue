<!-- frontend/src/modules/attendance/components/AttendanceImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'

import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'

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

const periodFrom = ref(null)
const periodTo = ref(null)
const remark = ref('')

const downloading = ref(false)
const importing = ref(false)
const uploadPercent = ref(0)

const fileName = computed(() => selectedFile.value?.name || '')
const fileSizeLabel = computed(() => {
  const size = Number(selectedFile.value?.size || 0)
  if (!size) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
})

const canImport = computed(() => {
  return Boolean(selectedFile.value) && !importing.value
})

watch(
  () => props.visible,
  (value) => {
    if (!value) {
      resetForm()
    }
  },
)

function closeDialog() {
  emit('update:visible', false)
}

function resetForm() {
  selectedFile.value = null
  periodFrom.value = null
  periodTo.value = null
  remark.value = ''
  uploadPercent.value = 0

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function triggerChooseFile() {
  if (importing.value) return
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const file = event?.target?.files?.[0] || null
  selectedFile.value = file
}

function formatDateForApi(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return ''

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function saveBlobFile(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename || 'download'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.URL.revokeObjectURL(url)
}

async function onDownloadSample() {
  if (downloading.value) return

  downloading.value = true
  try {
    const response = await downloadAttendanceImportSample()

    const contentDisposition = String(response?.headers?.['content-disposition'] || '')
    const match = contentDisposition.match(/filename="?([^"]+)"?/i)
    const filename = match?.[1] || 'attendance-import-sample.xlsx'

    saveBlobFile(response.data, filename)

    toast.add({
      severity: 'success',
      summary: 'Sample downloaded',
      detail: 'Attendance import sample downloaded successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail: error?.response?.data?.message || error?.message || 'Failed to download sample file.',
      life: 3500,
    })
  } finally {
    downloading.value = false
  }
}

async function onImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  uploadPercent.value = 0

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('sourceType', 'EXCEL')

    const fromValue = formatDateForApi(periodFrom.value)
    const toValue = formatDateForApi(periodTo.value)

    if (fromValue) formData.append('periodFrom', fromValue)
    if (toValue) formData.append('periodTo', toValue)
    if (String(remark.value || '').trim()) formData.append('remark', String(remark.value).trim())

    const response = await importAttendanceExcel(formData, {
      onUploadProgress(event) {
        const total = Number(event?.total || 0)
        const loaded = Number(event?.loaded || 0)

        if (total > 0) {
          uploadPercent.value = Math.min(100, Math.round((loaded / total) * 100))
        }
      },
    })

    const payload = response?.data?.data || null
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
      detail: error?.response?.data?.message || error?.message || 'Failed to import attendance file.',
      life: 4000,
    })
  } finally {
    importing.value = false
    uploadPercent.value = 0
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Import Attendance"
    :style="{ width: 'min(760px, 96vw)' }"
    :closable="!importing"
    :dismissableMask="!importing"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="flex flex-col gap-5">
      <div class="rounded-2xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-900/60">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="space-y-2">
            <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">
              Import attendance from Excel
            </h3>
            <p class="text-sm leading-6 text-surface-600 dark:text-surface-300">
              Use the sample file first, then upload your completed attendance sheet.
              Employee ID must match <span class="font-medium">employeeNo</span> in Employee master.
            </p>
          </div>

          <Button
            label="Download Sample"
            icon="pi pi-download"
            severity="secondary"
            outlined
            :loading="downloading"
            @click="onDownloadSample"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Period From
          </label>
          <DatePicker
            v-model="periodFrom"
            showIcon
            fluid
            dateFormat="yy-mm-dd"
            inputClass="w-full"
            placeholder="Optional"
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
            Period To
          </label>
          <DatePicker
            v-model="periodTo"
            showIcon
            fluid
            dateFormat="yy-mm-dd"
            inputClass="w-full"
            placeholder="Optional"
            :minDate="periodFrom || undefined"
          />
        </div>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-surface-700 dark:text-surface-200">
          Remark
        </label>
        <Textarea
          v-model="remark"
          rows="3"
          autoResize
          fluid
          placeholder="Optional note for this import batch"
        />
      </div>

      <div class="space-y-3 rounded-2xl border border-dashed border-surface-300 p-4 dark:border-surface-600">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="space-y-1">
            <h4 class="text-sm font-semibold text-surface-900 dark:text-surface-0">
              Attendance file
            </h4>
            <p class="text-sm text-surface-600 dark:text-surface-300">
              Supported formats: <span class="font-medium">.xlsx</span>,
              <span class="font-medium">.xls</span>, <span class="font-medium">.csv</span>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <input
              ref="fileInputRef"
              type="file"
              class="hidden"
              accept=".xlsx,.xls,.csv"
              @change="onFileChange"
            />

            <Button
              label="Choose File"
              icon="pi pi-upload"
              severity="contrast"
              @click="triggerChooseFile"
            />
          </div>
        </div>

        <div
          v-if="selectedFile"
          class="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/70 dark:bg-emerald-950/30"
        >
          <div class="flex flex-wrap items-center gap-2">
            <Tag severity="success" value="Ready" />
            <span class="text-sm font-medium text-surface-900 dark:text-surface-0">
              {{ fileName }}
            </span>
            <span class="text-xs text-surface-500 dark:text-surface-400">
              {{ fileSizeLabel }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="rounded-xl bg-surface-100 px-4 py-5 text-sm text-surface-500 dark:bg-surface-800 dark:text-surface-400"
        >
          No file selected yet.
        </div>

        <div v-if="importing" class="space-y-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-surface-700 dark:text-surface-200">Uploading...</span>
            <span class="font-medium text-surface-900 dark:text-surface-0">
              {{ uploadPercent }}%
            </span>
          </div>
          <ProgressBar :value="uploadPercent" />
        </div>
      </div>

      <div class="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900/40">
        <div class="space-y-2">
          <h4 class="text-sm font-semibold text-surface-900 dark:text-surface-0">
            Import notes
          </h4>
          <ul class="list-disc space-y-1 pl-5 text-sm leading-6 text-surface-600 dark:text-surface-300">
            <li>Employee ID in Excel must match <span class="font-medium">employeeNo</span>.</li>
            <li>Imported department, position, shift, and status are for comparison only.</li>
            <li>Final attendance result is derived by backend from punch times and assigned shift.</li>
          </ul>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="importing"
          @click="closeDialog"
        />
        <Button
          label="Import"
          icon="pi pi-check"
          :disabled="!canImport"
          :loading="importing"
          @click="onImport"
        />
      </div>
    </template>
  </Dialog>
</template>