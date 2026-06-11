<!-- frontend/src/modules/attendance/components/AttendanceImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import {
  downloadAttendanceImportSample,
  importAttendanceExcel,
} from '@/modules/attendance/attendance.api'
import {
  getApiErrorMessage,
  getApiErrorPayload,
  getApiErrorStatus,
} from '@/shared/utils/apiError'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

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
    if (!value) resetState()
  },
)

function resetState() {
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

function clearMessage() {
  errorTitle.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

function triggerChooseFile() {
  if (importing.value) return
  clearMessage()
  fileInputRef.value?.click()
}

function validateFile(file) {
  if (!file) return t('attendance.importDialog.chooseExcelFile')

  const lowerName = String(file.name || '').toLowerCase()
  const isValidFile =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv')

  if (!isValidFile) {
    return t('attendance.importDialog.invalidExcelFile')
  }

  const maxSize = 10 * 1024 * 1024

  if (file.size > maxSize) {
    return t('attendance.importDialog.fileTooLarge')
  }

  return ''
}

function onFileChange(event) {
  clearMessage()

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

function normalizeImportPayload(res) {
  const payload = normalizePayload(res)
  return payload.item || payload.import || payload
}

function getErrorTitle(error) {
  const status = getApiErrorStatus(error)

  if (status === 400) return t('attendance.importDialog.invalidExcelData')
  if (status === 401) return t('auth.accessDenied')
  if (status === 403) return t('auth.noPermission')
  if (status === 404) return t('attendance.importDialog.importApiNotFound')
  if (status === 409) return t('attendance.importDialog.duplicateData')
  if (status >= 500) return t('attendance.importDialog.serverError')

  return t('attendance.importDialog.importFailed')
}

function getImportErrorIssues(error) {
  const payload = getApiErrorPayload(error)
  const nested = payload?.error || {}

  if (Array.isArray(payload?.issues)) return payload.issues
  if (Array.isArray(payload?.errors)) return payload.errors
  if (Array.isArray(nested?.issues)) return nested.issues
  if (Array.isArray(nested?.errors)) return nested.errors

  return []
}

function getIssueRawValue(issue, keys = []) {
  const rawData = issue?.rawData || issue?.rowData || issue?.data || {}

  for (const key of keys) {
    const directValue = issue?.[key]

    if (directValue !== null && directValue !== undefined && String(directValue).trim()) {
      return String(directValue).trim()
    }
  }

  for (const [rawKey, rawValue] of Object.entries(rawData)) {
    const normalizedKey = String(rawKey || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    if (keys.some((key) => normalizedKey === String(key).toLowerCase().replace(/[^a-z0-9]/g, ''))) {
      return String(rawValue ?? '').trim()
    }
  }

  return ''
}

function formatImportErrorIssue(issue) {
  const rowNo = issue?.rawRowNo || issue?.rowNo || issue?.row || ''
  const employeeId = getIssueRawValue(issue, [
    'employeeId',
    'employeeNo',
    'employeeCode',
    'Employee ID',
    'EmployeeID',
  ])
  const clockIn = getIssueRawValue(issue, ['clockIn', 'Clock In', 'ClockIn'])
  const clockOut = getIssueRawValue(issue, ['clockOut', 'Clock Out', 'ClockOut'])
  const message = String(
    issue?.message ||
      issue?.reason ||
      issue?.detail ||
      issue?.description ||
      '',
  ).trim()

  const rowPrefix = rowNo ? `Row ${rowNo}` : 'Row error'
  const context = [
    employeeId ? `Employee ID: ${employeeId}` : '',
    clockIn ? `Clock In: ${clockIn}` : '',
    clockOut ? `Clock Out: ${clockOut}` : '',
  ].filter(Boolean)

  if (message && context.length) return `${rowPrefix}: ${message} (${context.join(', ')})`
  if (message) return `${rowPrefix}: ${message}`
  if (context.length) return `${rowPrefix}: Invalid row (${context.join(', ')})`
  if (rowNo) return `Row ${rowNo}: Invalid row`

  return ''
}

function buildImportValidationSummary(error, issueCount) {
  const payload = getApiErrorPayload(error)
  const nested = payload?.error || {}
  const duplicateCount = Number(
    payload?.params?.duplicateRowCount ||
      nested?.params?.duplicateRowCount ||
      0,
  )
  const failedCount = Number(
    payload?.params?.failedRowCount ||
      nested?.params?.failedRowCount ||
      issueCount ||
      0,
  )
  const parts = []

  if (duplicateCount) parts.push(`${duplicateCount} duplicate row(s)`)
  if (failedCount) parts.push(`${failedCount} error row(s)`)

  const issueText = parts.length
    ? parts.join(', ')
    : `${issueCount} row issue(s)`

  return `Import rejected: ${issueText}. No attendance records were updated.`
}

function makeFriendlyImportMessage(error) {
  const payload = getApiErrorPayload(error)
  const nested = payload?.error || {}
  const issues = getImportErrorIssues(error)
  const issueLines = issues
    .map(formatImportErrorIssue)
    .filter(Boolean)

  if (issueLines.length) {
    const previewLines = issueLines.slice(0, 50)
    const moreText = issueLines.length > previewLines.length
      ? `\n...and ${issueLines.length - previewLines.length} more row(s).`
      : ''

    return `${buildImportValidationSummary(error, issueLines.length)}\n\n${previewLines.join('\n')}${moreText}`
  }

  let text =
    String(payload?.message || nested?.message || '').trim() ||
    getApiErrorMessage(error, t('attendance.importDialog.failedImportFile'))

  if (/attendance\s*date|attendanceDate/i.test(text)) {
    text = `${text}. ${t('attendance.importDialog.selectAttendanceDate')}`
  } else if (/employee\s*(id|no|code)|employeeNo|employeeCode/i.test(text)) {
    text = `${text}. ${t('attendance.importDialog.checkEmployeeMaster')}`
  } else if (/shift\s*(id|code|name)?/i.test(text)) {
    text = `${text}. ${t('attendance.importDialog.checkShiftMaster')}`
  } else if (/date\s*format|invalid\s*date/i.test(text)) {
    text = `${text}. ${t('attendance.importDialog.dateFormatHelp')}`
  } else if (/clock|time|HH:mm/i.test(text)) {
    text = `${text}. ${t('attendance.importDialog.timeFormatHelp')}`
  }

  return text
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
  clearMessage()

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
    errorTitle.value = getErrorTitle(error)
    errorMessage.value = makeFriendlyImportMessage(error)
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (importing.value) return

  clearMessage()

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

    emit('success', normalizeImportPayload(res))
    closeDialog()
  } catch (error) {
    errorTitle.value = getErrorTitle(error)
    errorMessage.value = makeFriendlyImportMessage(error)
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
    :style="{ width: '36rem', maxWidth: '96vw' }"
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