<!-- frontend/src/modules/attendance/components/AttendanceImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'

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
const { t } = useI18n()

const fileInputRef = ref(null)
const selectedFile = ref(null)
const attendanceDate = ref('')

const downloading = ref(false)
const importing = ref(false)
const uploadProgress = ref(0)

const errorTitle = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const fileName = computed(() => selectedFile.value?.name || '')

const canImport = computed(() => {
  return Boolean(selectedFile.value && attendanceDate.value && !importing.value)
})

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
  attendanceDate.value = ''
  uploadProgress.value = 0
  errorTitle.value = ''
  errorMessage.value = ''
  successMessage.value = ''

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function closeDialog() {
  if (importing.value) return
  emit('update:visible', false)
}

function clearMessages() {
  errorTitle.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

function triggerChooseFile() {
  if (importing.value) return
  clearMessages()
  fileInputRef.value?.click()
}

function validateFile(file) {
  if (!file) return t('attendance.importDialog.chooseExcelFile')

  const name = String(file.name || '').toLowerCase()
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')

  if (!isExcel) {
    return t('attendance.importDialog.invalidExcelFile')
  }

  const maxSize = 10 * 1024 * 1024

  if (file.size > maxSize) {
    return t('attendance.importDialog.fileTooLarge')
  }

  return ''
}

function onFileChange(event) {
  clearMessages()

  const file = event?.target?.files?.[0] || null
  const message = validateFile(file)

  if (message) {
    selectedFile.value = null

    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }

    errorTitle.value = t('attendance.importDialog.invalidFile')
    errorMessage.value = message

    return
  }

  selectedFile.value = file
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function getFilenameFromHeader(res, fallback) {
  const disposition = String(res?.headers?.['content-disposition'] || '')
  const match = disposition.match(/filename="?([^"]+)"?/i)

  return match?.[1] || fallback
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
  if (downloading.value) return

  downloading.value = true
  clearMessages()

  try {
    const res = await downloadAttendanceImportSample()

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(
      blob,
      getFilenameFromHeader(res, 'attendance-import-sample.xlsx'),
    )

    successMessage.value = t('attendance.importDialog.sampleDownloaded')
  } catch (error) {
    errorTitle.value = t('attendance.importDialog.downloadFailed')
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      t('attendance.importDialog.failedDownloadSample')
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (importing.value) return

  clearMessages()

  if (!attendanceDate.value) {
    errorTitle.value = t('attendance.importDialog.validation')
    errorMessage.value = t('attendance.importDialog.selectAttendanceDate')
    return
  }

  const fileMessage = validateFile(selectedFile.value)

  if (fileMessage) {
    errorTitle.value = t('attendance.importDialog.validation')
    errorMessage.value = fileMessage
    return
  }

  importing.value = true
  uploadProgress.value = 0

  try {
    const res = await importAttendanceExcel(selectedFile.value, {
      payload: {
        sourceType: 'EXCEL',
        attendanceDate: attendanceDate.value,
      },
      onUploadProgress(event) {
        if (!event.total) return
        uploadProgress.value = Math.round((event.loaded * 100) / event.total)
      },
    })

    const payload = normalizePayload(res)
    const importInfo = payload?.import || payload?.item || payload || null

    toast.add({
      severity: 'success',
      summary: t('attendance.importDialog.importCompleted'),
      detail:
        importInfo?.status === 'PARTIAL_SUCCESS'
          ? t('attendance.importDialog.importCompletedPartial')
          : t('attendance.importDialog.importCompletedSuccess'),
      life: 3000,
    })

    emit('success', payload)
    closeDialog()
  } catch (error) {
    errorTitle.value = t('attendance.importDialog.importFailed')
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      t('attendance.importDialog.failedImportFile')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('attendance.importDialog.title')"
    :style="{ width: '34rem', maxWidth: '96vw' }"
    :closable="!importing"
    :dismissable-mask="!importing"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div
        v-if="errorMessage"
        class="ot-inline-error"
      >
        <div class="flex items-start gap-3">
          <i class="pi pi-exclamation-triangle mt-0.5" />

          <div class="min-w-0">
            <div class="font-bold">
              {{ errorTitle || t('common.somethingWentWrong') }}
            </div>

            <div class="mt-1 whitespace-pre-line leading-6">
              {{ errorMessage }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="successMessage"
        class="ot-inline-info"
      >
        <div class="flex items-start gap-3">
          <i class="pi pi-check-circle mt-0.5" />

          <div class="min-w-0">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <div class="ot-panel">
        <div class="text-sm font-bold text-[color:var(--ot-text)]">
          {{ t('attendance.importDialog.guideTitle') }}
        </div>

        <div class="mt-2 space-y-1 text-sm leading-6 text-[color:var(--ot-text-muted)]">
          <div>1. {{ t('attendance.importDialog.guideStep1') }}</div>
          <div>2. {{ t('attendance.importDialog.guideStep2') }}</div>
          <div>3. {{ t('attendance.importDialog.guideStep3') }}</div>
          <div>4. {{ t('attendance.importDialog.guideStep4') }}</div>
        </div>

        <div class="mt-3 rounded-xl bg-[color:var(--ot-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--ot-text-muted)]">
          {{ t('attendance.importDialog.note') }}
        </div>

        <div class="mt-4">
          <Button
            :label="t('attendance.importDialog.downloadSample')"
            icon="pi pi-download"
            outlined
            severity="secondary"
            size="small"
            :loading="downloading"
            @click="handleDownloadSample"
          />
        </div>
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="attendanceDate"
          :label="t('attendance.field.attendanceDate')"
          :placeholder="t('attendance.field.selectAttendanceDate')"
          :clearable="false"
        />
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
            <div class="text-sm font-bold text-[color:var(--ot-text)]">
              {{ t('attendance.importDialog.excelFile') }}
            </div>

            <div class="mt-1 truncate text-sm text-[color:var(--ot-text-muted)]">
              {{ fileName || t('attendance.importDialog.noFileSelected') }}
            </div>
          </div>

          <Button
            :label="t('attendance.importDialog.chooseFile')"
            icon="pi pi-upload"
            severity="secondary"
            outlined
            size="small"
            :disabled="importing"
            @click="triggerChooseFile"
          />
        </div>
      </div>

      <ProgressBar
        v-if="importing"
        :value="uploadProgress"
        style="height: 6px"
      />
    </div>

    <template #footer>
      <div class="ot-form-footer">
        <Button
          :label="t('common.cancel')"
          text
          size="small"
          :disabled="importing"
          @click="closeDialog"
        />

        <Button
          :label="t('common.import')"
          icon="pi pi-check"
          size="small"
          :disabled="!canImport"
          :loading="importing"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>