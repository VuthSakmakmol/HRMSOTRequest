<!-- frontend/src/modules/org/components/EmployeeImportDialog.vue -->
<script setup>
// frontend/src/modules/org/components/EmployeeImportDialog.vue

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import {
  createEmployeeImportJobId,
  downloadEmployeeImportSample,
  getEmployeeImportProgress,
  importEmployeesExcel,
} from '@/modules/org/employee.api'
import {
  getApiErrorMessage,
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

const POLL_INTERVAL_MS = 700

const PHASE_ORDER = [
  'UPLOAD',
  'READ_FILE',
  'PARSE_ROWS',
  'VALIDATE_BASIC',
  'MATCH_DEPARTMENT',
  'MATCH_POSITION',
  'MATCH_LINE',
  'MATCH_SHIFT',
  'MATCH_EMPLOYEE',
  'MATCH_ACCOUNT',
  'VALIDATE_RELATION',
  'IMPORT_EMPLOYEE',
  'RESOLVE_MANAGER',
  'CREATE_ACCOUNT',
  'SYNC_MANAGER',
  'COMPLETE',
]

const PHASE_ICON_MAP = {
  UPLOAD: 'pi pi-cloud-upload',
  READ_FILE: 'pi pi-file-excel',
  PARSE_ROWS: 'pi pi-list',
  VALIDATE_BASIC: 'pi pi-check-square',
  MATCH_DEPARTMENT: 'pi pi-sitemap',
  MATCH_POSITION: 'pi pi-briefcase',
  MATCH_LINE: 'pi pi-share-alt',
  MATCH_SHIFT: 'pi pi-clock',
  MATCH_EMPLOYEE: 'pi pi-users',
  MATCH_ACCOUNT: 'pi pi-id-card',
  VALIDATE_RELATION: 'pi pi-shield',
  IMPORT_EMPLOYEE: 'pi pi-database',
  RESOLVE_MANAGER: 'pi pi-users',
  CREATE_ACCOUNT: 'pi pi-key',
  SYNC_MANAGER: 'pi pi-sync',
  COMPLETE: 'pi pi-check-circle',
}

const fileInputRef = ref(null)
const selectedFile = ref(null)

const downloading = ref(false)
const importing = ref(false)

const uploadProgress = ref(0)
const progressJobId = ref('')
const progressPayload = ref(null)
const progressPollErrors = ref(0)

const errorTitle = ref('')
const errorMessage = ref('')
const errorRows = ref([])
const successMessage = ref('')

let progressTimer = null

const fileName = computed(() => selectedFile.value?.name || '')
const hasImportErrors = computed(() => errorRows.value.length > 0)
const importErrorCount = computed(() => errorRows.value.length)

const completedPhases = computed(() => {
  const phases = progressPayload.value?.completedPhases

  return Array.isArray(phases) ? phases.map((item) => String(item || '')) : []
})

const backendPercent = computed(() => {
  return clampPercent(progressPayload.value?.percent || 0)
})

const uploadOverallPercent = computed(() => {
  if (!uploadProgress.value) return 0

  return clampPercent(Math.max(1, Math.round(uploadProgress.value * 0.08)))
})

const progressPercent = computed(() => {
  return clampPercent(Math.max(backendPercent.value, uploadOverallPercent.value))
})

const currentPhase = computed(() => {
  return String(progressPayload.value?.phase || 'UPLOAD').trim() || 'UPLOAD'
})

const progressStatus = computed(() => {
  return String(progressPayload.value?.status || '').trim().toUpperCase() || 'WAITING_UPLOAD'
})

const isProgressSuccess = computed(() => progressStatus.value === 'SUCCESS')
const isProgressFailed = computed(() => progressStatus.value === 'FAILED')
const isProgressFinished = computed(() => isProgressSuccess.value || isProgressFailed.value)

const hasProgress = computed(() => {
  return importing.value || uploadProgress.value > 0 || !!progressPayload.value
})

const currentProgressMessage = computed(() => {
  const payload = progressPayload.value || {}

  const translated = translateProgressMessage(payload)

  if (translated) return translated

  if (uploadProgress.value > 0 && uploadProgress.value < 100) {
    return t('org.employee.importUploading', {
      percent: uploadProgress.value,
    })
  }

  if (uploadProgress.value >= 100 && importing.value) {
    return t('org.employee.importProgress.readFile')
  }

  return t('org.employee.importProgress.waitingUpload')
})

const currentRowProgressText = computed(() => {
  const processed = Number(progressPayload.value?.processedRows || 0)
  const total = Number(progressPayload.value?.totalRows || 0)

  if (!total) return ''

  return t('org.employee.importProgress.rowProgress', {
    processed,
    total,
  })
})

const currentStatusLabel = computed(() => {
  if (isProgressSuccess.value) return t('org.employee.importProgress.statusSuccess')
  if (isProgressFailed.value) return t('org.employee.importProgress.statusFailed')
  if (importing.value) return t('org.employee.importProgress.statusRunning')

  return t('org.employee.importProgress.statusWaiting')
})

const progressCardClass = computed(() => ({
  'employee-import-progress-card--success': isProgressSuccess.value,
  'employee-import-progress-card--failed': isProgressFailed.value,
}))

const progressSteps = computed(() =>
  PHASE_ORDER.map((phase) => ({
    phase,
    icon: PHASE_ICON_MAP[phase] || 'pi pi-circle',
    label: progressPhaseLabel(phase),
  })),
)

watch(
  () => props.visible,
  (value) => {
    if (!value) {
      resetState()
    }
  },
)

onBeforeUnmount(() => {
  stopProgressPolling()
})

function s(value) {
  return String(value ?? '').trim()
}

function clampPercent(value) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(100, Math.round(number)))
}

function resetState() {
  selectedFile.value = null
  uploadProgress.value = 0
  progressJobId.value = ''
  progressPayload.value = null
  progressPollErrors.value = 0

  errorTitle.value = ''
  errorMessage.value = ''
  errorRows.value = []
  successMessage.value = ''

  stopProgressPolling()

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function resetProgressOnly() {
  uploadProgress.value = 0
  progressJobId.value = ''
  progressPayload.value = null
  progressPollErrors.value = 0
  stopProgressPolling()
}

function closeDialog() {
  if (importing.value) return
  emit('update:visible', false)
}

function clearMessage() {
  errorTitle.value = ''
  errorMessage.value = ''
  errorRows.value = []
  successMessage.value = ''
}

function clearImportFeedback() {
  clearMessage()
  resetProgressOnly()
}

function triggerChooseFile() {
  if (importing.value) return

  clearImportFeedback()
  fileInputRef.value?.click()
}

function onFileChange(event) {
  clearImportFeedback()

  const file = event?.target?.files?.[0] || null

  if (!file) {
    selectedFile.value = null
    return
  }

  const lowerName = String(file.name || '').toLowerCase()
  const isValidFile =
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv')

  if (!isValidFile) {
    selectedFile.value = null

    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }

    errorTitle.value = t('org.employee.importInvalidFileTitle')
    errorMessage.value = t('org.employee.importInvalidFileMessage')
    return
  }

  selectedFile.value = file
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeImportPayload(res) {
  const payload = normalizePayload(res)
  return payload.item || payload
}

function normalizeProgressPayload(res) {
  const payload = normalizePayload(res)
  return payload.item || payload
}

function normalizeErrorPayload(error) {
  const data = error?.response?.data || {}

  return data?.data || data || {}
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value
  }

  return []
}

function normalizeImportErrorRow(item, index) {
  if (typeof item === 'string') {
    return {
      id: `error-${index}`,
      rowNo: '',
      field: '',
      value: '',
      reason: item,
    }
  }

  const rowNo = item?.rowNo ?? item?.row ?? item?.line ?? ''
  const field = item?.field ?? item?.column ?? item?.key ?? ''
  const value = item?.value ?? item?.input ?? ''
  const reason =
    item?.reason ||
    item?.message ||
    item?.detail ||
    item?.error ||
    t('org.employee.importUnknownError')

  return {
    id: `${rowNo || 'row'}-${field || 'field'}-${index}`,
    rowNo,
    field,
    value,
    reason,
  }
}

function getImportErrorRows(error) {
  const payload = normalizeErrorPayload(error)

  const rows = firstArray(
    payload?.params?.errors,
    payload?.meta?.errors,
    payload?.details?.errors,
    payload?.data?.params?.errors,
    payload?.data?.errors,
    payload?.errors,
    payload?.issues,
    payload?.error?.params?.errors,
    payload?.error?.errors,
    payload?.error?.issues,
  )

  return rows.map(normalizeImportErrorRow)
}

function getErrorTitle(error) {
  const status = getApiErrorStatus(error)

  if (status === 400) return t('org.employee.invalidExcelData')
  if (status === 401) return t('auth.accessDenied')
  if (status === 403) return t('auth.noPermission')
  if (status === 404) return t('org.employee.importApiNotFound')
  if (status === 409) return t('org.employee.duplicateData')
  if (status >= 500) return t('org.employee.serverError')

  return t('org.employee.importFailed')
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

function progressPhaseLabel(phase) {
  const key = `org.employee.importProgress.phase.${phase}`
  const translated = t(key)

  return translated && translated !== key ? translated : phase
}

function translateProgressMessage(payload = {}) {
  const messageKey = s(payload.messageKey)

  if (messageKey) {
    const translated = t(messageKey)

    if (translated && translated !== messageKey) return translated
  }

  return s(payload.message)
}

function stepIndex(phase) {
  return PHASE_ORDER.indexOf(String(phase || '').trim().toUpperCase())
}

function isStepComplete(phase) {
  if (isProgressSuccess.value) return true
  if (completedPhases.value.includes(phase)) return true
  if (phase === 'UPLOAD' && uploadProgress.value >= 100) return true

  const currentIndex = stepIndex(currentPhase.value)
  const phaseIndex = stepIndex(phase)

  return currentIndex > phaseIndex && currentIndex >= 0 && phaseIndex >= 0
}

function isStepActive(phase) {
  if (isProgressFinished.value) return false

  return currentPhase.value === phase
}

function stepClass(phase) {
  return {
    'employee-import-step--complete': isStepComplete(phase),
    'employee-import-step--active': isStepActive(phase),
    'employee-import-step--failed': isProgressFailed.value && isStepActive(phase),
  }
}

function applyProgressPayload(item = {}) {
  if (!item || typeof item !== 'object') return

  progressPayload.value = {
    ...progressPayload.value,
    ...item,
  }

  const status = String(item.status || '').trim().toUpperCase()

  if (status === 'SUCCESS' || status === 'FAILED') {
    stopProgressPolling()
  }
}

async function fetchProgressOnce() {
  if (!progressJobId.value) return

  try {
    const res = await getEmployeeImportProgress(progressJobId.value)
    const item = normalizeProgressPayload(res)

    progressPollErrors.value = 0
    applyProgressPayload(item)
  } catch {
    progressPollErrors.value += 1

    if (progressPollErrors.value >= 8) {
      stopProgressPolling()
    }
  }
}

function startProgressPolling(jobId) {
  stopProgressPolling()

  progressJobId.value = jobId
  progressPollErrors.value = 0

  fetchProgressOnce()

  progressTimer = window.setInterval(() => {
    fetchProgressOnce()
  }, POLL_INTERVAL_MS)
}

function stopProgressPolling() {
  if (progressTimer) {
    window.clearInterval(progressTimer)
    progressTimer = null
  }
}

function buildSuccessMessage(payload = {}) {
  const summary = payload?.summary || {}
  const created = Number(summary.created || payload?.created || payload?.createdCount || 0)
  const updated = Number(summary.updated || payload?.updated || payload?.updatedCount || 0)
  const accountsCreated = Number(
    summary.accountsCreated || payload?.accountsCreated || 0,
  )

  return t('org.employee.importedSuccess', {
    created,
    updated,
    accountsCreated,
  })
}

async function handleDownloadSample() {
  downloading.value = true
  clearMessage()

  try {
    const res = await downloadEmployeeImportSample()

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, 'employee-import-sample.xlsx'))
    successMessage.value = t('org.employee.sampleDownloaded')
  } catch (error) {
    errorTitle.value = getErrorTitle(error)
    errorMessage.value = getApiErrorMessage(error, t('org.employee.downloadSampleFailed'))
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  uploadProgress.value = 0
  progressPayload.value = null
  progressPollErrors.value = 0
  clearMessage()

  const jobId = createEmployeeImportJobId()

  applyProgressPayload({
    jobId,
    status: 'RUNNING',
    phase: 'UPLOAD',
    percent: 1,
    messageKey: 'org.employee.importProgress.waitingUpload',
    message: 'Waiting for file upload...',
    totalRows: 0,
    processedRows: 0,
    completedPhases: [],
  })

  startProgressPolling(jobId)

  try {
    const res = await importEmployeesExcel(selectedFile.value, {
      jobId,
      onUploadProgress(event) {
        if (!event.total) return

        uploadProgress.value = clampPercent((event.loaded * 100) / event.total)

        if (uploadProgress.value >= 100) {
          applyProgressPayload({
            jobId,
            status: 'RUNNING',
            phase: currentPhase.value === 'UPLOAD' ? 'READ_FILE' : currentPhase.value,
            percent: Math.max(progressPercent.value, 8),
            messageKey: 'org.employee.importProgress.readFile',
            message: 'Reading Excel file...',
            completedPhases: ['UPLOAD'],
          })
        }
      },
    })

    const payload = normalizeImportPayload(res)

    applyProgressPayload({
      jobId,
      status: 'SUCCESS',
      phase: 'COMPLETE',
      percent: 100,
      messageKey: 'org.employee.importProgress.completed',
      message: 'Import completed.',
      summary: payload?.summary || null,
      completedPhases: PHASE_ORDER,
    })

    successMessage.value = buildSuccessMessage(payload)

    emit('success', payload)
  } catch (error) {
    const rows = getImportErrorRows(error)

    errorRows.value = rows
    errorTitle.value = rows.length
      ? t('org.employee.importValidationFailed')
      : getErrorTitle(error)
    errorMessage.value = getApiErrorMessage(error, t('org.employee.importFailed'))

    applyProgressPayload({
      jobId,
      status: 'FAILED',
      phase: 'FAILED',
      percent: progressPercent.value || 1,
      messageKey: 'org.employee.importProgress.failed',
      message: errorMessage.value,
    })
  } finally {
    importing.value = false
    stopProgressPolling()
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('org.employee.importTitle')"
    :style="{ width: '64rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="employee-import-dialog">
      <div
        v-if="errorMessage"
        class="ot-inline-error"
      >
        <div class="employee-import-message">
          <i class="pi pi-exclamation-triangle employee-import-message__icon" />

          <div class="min-w-0 flex-1">
            <div class="employee-import-message__title">
              {{ errorTitle || t('org.employee.importFailed') }}
            </div>

            <div class="employee-import-message__text">
              {{ errorMessage }}
            </div>

            <div
              v-if="hasImportErrors"
              class="employee-import-error-count"
            >
              {{ t('org.employee.importErrorCount', { count: importErrorCount }) }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="hasImportErrors"
        class="employee-import-errors"
      >
        <div class="employee-import-errors__header">
          <div>
            <div class="employee-import-errors__title">
              {{ t('org.employee.importErrorListTitle') }}
            </div>

            <div class="employee-import-errors__subtitle">
              {{ t('org.employee.importAllOrNothingNote') }}
            </div>
          </div>
        </div>

        <div class="employee-import-errors__table-wrap">
          <table class="employee-import-errors__table">
            <thead>
              <tr>
                <th>{{ t('org.employee.importRow') }}</th>
                <th>{{ t('org.employee.importField') }}</th>
                <th>{{ t('org.employee.importValue') }}</th>
                <th>{{ t('org.employee.importReason') }}</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="item in errorRows"
                :key="item.id"
              >
                <td>
                  <span class="employee-import-row-badge">
                    {{ item.rowNo || '-' }}
                  </span>
                </td>

                <td>{{ item.field || '-' }}</td>

                <td>
                  <span class="employee-import-value">
                    {{ item.value || '-' }}
                  </span>
                </td>

                <td>{{ item.reason || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="successMessage"
        class="ot-inline-info"
      >
        <div class="employee-import-message">
          <i class="pi pi-check-circle employee-import-message__icon" />

          <div class="min-w-0">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <div class="ot-panel employee-import-simple-guide">
        <div class="employee-import-simple-row">
          <div class="employee-import-guide-title">
            {{ t('org.employee.importGuideTitle') }}
          </div>

          <Button
            :label="t('org.employee.downloadSample')"
            icon="pi pi-download"
            outlined
            severity="secondary"
            size="small"
            :loading="downloading"
            :disabled="importing"
            @click="handleDownloadSample"
          />
        </div>

        <div class="employee-import-simple-rules">
          <span class="employee-import-rule-pill">
            {{ t('org.employee.blankLineMeansNoLine') }}
          </span>

          <span class="employee-import-rule-pill employee-import-rule-pill--warning">
            {{ t('org.employee.employeeLineNotAllLines') }}
          </span>
        </div>

        <div class="employee-import-note">
          <i class="pi pi-shield" />
          <span>{{ t('org.employee.importAllOrNothingNote') }}</span>
        </div>
      </div>

      <div class="employee-import-file-box">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onFileChange"
        >

        <div class="employee-import-file-row">
          <div class="min-w-0">
            <div class="employee-import-file-title">
              {{ t('org.employee.excelFile') }}
            </div>

            <div class="employee-import-file-name">
              {{ fileName || t('org.employee.noFileSelected') }}
            </div>
          </div>

          <Button
            :label="t('org.employee.chooseFile')"
            icon="pi pi-upload"
            severity="secondary"
            outlined
            size="small"
            :disabled="importing"
            @click="triggerChooseFile"
          />
        </div>
      </div>

      <div
        v-if="hasProgress"
        class="employee-import-progress-card"
        :class="progressCardClass"
      >
        <div class="employee-import-progress-head">
          <div class="min-w-0">
            <div class="employee-import-progress-title">
              <i
                v-if="importing && !isProgressFinished"
                class="pi pi-spin pi-spinner"
              />
              <i
                v-else-if="isProgressSuccess"
                class="pi pi-check-circle"
              />
              <i
                v-else-if="isProgressFailed"
                class="pi pi-times-circle"
              />
              <i
                v-else
                class="pi pi-clock"
              />

              <span>{{ t('org.employee.importProgress.runningTitle') }}</span>
            </div>

            <div class="employee-import-progress-message">
              {{ currentProgressMessage }}
            </div>
          </div>

          <div class="employee-import-progress-status">
            <span class="employee-import-progress-percent">
              {{ progressPercent }}%
            </span>

            <span class="employee-import-progress-badge">
              {{ currentStatusLabel }}
            </span>
          </div>
        </div>

        <ProgressBar
          :value="progressPercent"
          style="height: 8px"
        />

        <div class="employee-import-progress-meta">
          <span>
            {{ t('org.employee.importProgress.percentDone', { percent: progressPercent }) }}
          </span>

          <span v-if="currentRowProgressText">
            {{ currentRowProgressText }}
          </span>

          <span v-if="uploadProgress > 0 && !isProgressSuccess">
            {{ t('org.employee.importProgress.fileUpload', { percent: uploadProgress }) }}
          </span>
        </div>

        <div class="employee-import-steps">
          <div
            v-for="step in progressSteps"
            :key="step.phase"
            class="employee-import-step"
            :class="stepClass(step.phase)"
          >
            <span class="employee-import-step__icon">
              <i :class="step.icon" />
            </span>

            <span class="employee-import-step__label">
              {{ step.label }}
            </span>
          </div>
        </div>
      </div>
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
          :disabled="!selectedFile || importing"
          :loading="importing"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.employee-import-dialog {
  display: grid;
  gap: 1rem;
}

.employee-import-message {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.employee-import-message__icon {
  margin-top: 0.16rem;
  flex: 0 0 auto;
}

.employee-import-message__title {
  font-weight: 750;
}

.employee-import-message__text {
  margin-top: 0.28rem;
  white-space: pre-line;
  line-height: 1.55;
}

.employee-import-guide-header {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.employee-import-guide-title,
.employee-import-file-title {
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 700;
}

.employee-import-simple-guide {
  display: grid;
  gap: 0.75rem;
}

.employee-import-simple-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.employee-import-simple-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.employee-import-rule-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(37, 99, 235, 0.18);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  padding: 0.28rem 0.65rem;
  color: rgb(37, 99, 235);
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1.25;
}

.employee-import-rule-pill--warning {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(245, 158, 11, 0.1);
  color: rgb(217, 119, 6);
}

:global(.dark) .employee-import-rule-pill {
  border-color: rgba(96, 165, 250, 0.28);
  background: rgba(96, 165, 250, 0.14);
  color: rgb(147, 197, 253);
}

:global(.dark) .employee-import-rule-pill--warning {
  border-color: rgba(251, 191, 36, 0.3);
  background: rgba(251, 191, 36, 0.14);
  color: rgb(252, 211, 77);
}


.employee-import-error-count {
  display: inline-flex;
  align-items: center;
  margin-top: 0.55rem;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.1);
  padding: 0.22rem 0.6rem;
  color: rgb(185, 28, 28);
  font-size: 0.75rem;
  font-weight: 750;
}

.employee-import-errors {
  overflow: hidden;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: 1rem;
  background: rgba(254, 242, 242, 0.72);
}

.employee-import-errors__header {
  border-bottom: 1px solid rgba(220, 38, 38, 0.15);
  padding: 0.8rem 0.9rem;
}

.employee-import-errors__title {
  color: rgb(127, 29, 29);
  font-size: 0.88rem;
  font-weight: 800;
}

.employee-import-errors__subtitle {
  margin-top: 0.18rem;
  color: rgb(153, 27, 27);
  font-size: 0.76rem;
  line-height: 1.45;
}

.employee-import-errors__table-wrap {
  max-height: 20rem;
  overflow: auto;
}

.employee-import-errors__table {
  width: 100%;
  min-width: 48rem;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.employee-import-errors__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(254, 226, 226);
  color: rgb(127, 29, 29);
  font-weight: 800;
  text-align: left;
}

.employee-import-errors__table th,
.employee-import-errors__table td {
  border-bottom: 1px solid rgba(220, 38, 38, 0.12);
  padding: 0.55rem 0.65rem;
  vertical-align: top;
}

.employee-import-errors__table td {
  color: var(--ot-text);
  line-height: 1.45;
}

.employee-import-row-badge {
  display: inline-flex;
  min-width: 2.1rem;
  justify-content: center;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.1);
  padding: 0.12rem 0.45rem;
  color: rgb(185, 28, 28);
  font-weight: 800;
}

.employee-import-value {
  display: inline-block;
  max-width: 14rem;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.employee-import-note {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.85rem;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  padding: 0.38rem 0.7rem;
  color: rgb(37, 99, 235);
  font-size: 0.76rem;
  font-weight: 700;
}

.employee-import-file-box {
  border: 1px dashed var(--ot-border);
  border-radius: 1rem;
  padding: 1rem;
}

.employee-import-file-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.employee-import-file-name {
  margin-top: 0.2rem;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.employee-import-progress-card {
  display: grid;
  gap: 0.8rem;
  border: 1px solid rgba(37, 99, 235, 0.16);
  border-radius: 1rem;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.12), transparent 34%),
    var(--ot-surface);
  padding: 1rem;
}

.employee-import-progress-card--success {
  border-color: rgba(22, 163, 74, 0.22);
  background:
    radial-gradient(circle at top left, rgba(22, 163, 74, 0.12), transparent 34%),
    var(--ot-surface);
}

.employee-import-progress-card--failed {
  border-color: rgba(220, 38, 38, 0.22);
  background:
    radial-gradient(circle at top left, rgba(220, 38, 38, 0.12), transparent 34%),
    var(--ot-surface);
}

.employee-import-progress-head {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.employee-import-progress-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 750;
}

.employee-import-progress-message {
  margin-top: 0.25rem;
  color: var(--ot-text-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

.employee-import-progress-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.employee-import-progress-percent {
  color: var(--ot-text);
  font-size: 1.25rem;
  font-weight: 850;
  line-height: 1;
}

.employee-import-progress-badge {
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  padding: 0.24rem 0.6rem;
  color: rgb(37, 99, 235);
  font-size: 0.72rem;
  font-weight: 750;
}

.employee-import-progress-card--success .employee-import-progress-badge {
  background: rgba(22, 163, 74, 0.1);
  color: rgb(22, 163, 74);
}

.employee-import-progress-card--failed .employee-import-progress-badge {
  background: rgba(220, 38, 38, 0.1);
  color: rgb(185, 28, 28);
}

.employee-import-progress-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  color: var(--ot-text-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.employee-import-progress-meta span {
  border-radius: 999px;
  background: var(--ot-surface-2);
  padding: 0.25rem 0.55rem;
}

.employee-import-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: 0.45rem;
}

.employee-import-step {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.48rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface-2);
  padding: 0.52rem 0.62rem;
  color: var(--ot-text-muted);
  font-size: 0.76rem;
  font-weight: 650;
}

.employee-import-step__icon {
  display: inline-flex;
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.1);
  color: rgb(100, 116, 139);
  font-size: 0.72rem;
}

.employee-import-step__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.employee-import-step--active {
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(37, 99, 235, 0.08);
  color: rgb(37, 99, 235);
}

.employee-import-step--active .employee-import-step__icon {
  background: rgba(37, 99, 235, 0.14);
  color: rgb(37, 99, 235);
}

.employee-import-step--complete {
  border-color: rgba(22, 163, 74, 0.22);
  background: rgba(22, 163, 74, 0.08);
  color: rgb(22, 163, 74);
}

.employee-import-step--complete .employee-import-step__icon {
  background: rgba(22, 163, 74, 0.14);
  color: rgb(22, 163, 74);
}

.employee-import-step--failed {
  border-color: rgba(220, 38, 38, 0.26);
  background: rgba(220, 38, 38, 0.08);
  color: rgb(185, 28, 28);
}

.employee-import-step--failed .employee-import-step__icon {
  background: rgba(220, 38, 38, 0.14);
  color: rgb(185, 28, 28);
}

:global(.dark) .employee-import-error-count {
  background: rgba(248, 113, 113, 0.14);
  color: rgb(252, 165, 165);
}

:global(.dark) .employee-import-errors {
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(127, 29, 29, 0.12);
}

:global(.dark) .employee-import-errors__header {
  border-bottom-color: rgba(248, 113, 113, 0.22);
}

:global(.dark) .employee-import-errors__title {
  color: rgb(252, 165, 165);
}

:global(.dark) .employee-import-errors__subtitle {
  color: rgb(254, 202, 202);
}

:global(.dark) .employee-import-errors__table th {
  background: rgb(69, 10, 10);
  color: rgb(254, 202, 202);
}

:global(.dark) .employee-import-row-badge {
  background: rgba(248, 113, 113, 0.16);
  color: rgb(252, 165, 165);
}

:global(.dark) .employee-import-note {
  background: rgba(96, 165, 250, 0.14);
  color: rgb(147, 197, 253);
}

:global(.dark) .employee-import-progress-badge {
  background: rgba(96, 165, 250, 0.14);
  color: rgb(147, 197, 253);
}

:global(.dark) .employee-import-progress-card--success .employee-import-progress-badge {
  background: rgba(74, 222, 128, 0.14);
  color: rgb(134, 239, 172);
}

:global(.dark) .employee-import-progress-card--failed .employee-import-progress-badge {
  background: rgba(248, 113, 113, 0.14);
  color: rgb(252, 165, 165);
}

:global(.dark) .employee-import-step--active {
  border-color: rgba(96, 165, 250, 0.34);
  background: rgba(96, 165, 250, 0.12);
  color: rgb(147, 197, 253);
}

:global(.dark) .employee-import-step--active .employee-import-step__icon {
  background: rgba(96, 165, 250, 0.16);
  color: rgb(147, 197, 253);
}

:global(.dark) .employee-import-step--complete {
  border-color: rgba(74, 222, 128, 0.32);
  background: rgba(74, 222, 128, 0.12);
  color: rgb(134, 239, 172);
}

:global(.dark) .employee-import-step--complete .employee-import-step__icon {
  background: rgba(74, 222, 128, 0.16);
  color: rgb(134, 239, 172);
}

:global(.dark) .employee-import-step--failed {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(248, 113, 113, 0.12);
  color: rgb(252, 165, 165);
}

:global(.dark) .employee-import-step--failed .employee-import-step__icon {
  background: rgba(248, 113, 113, 0.16);
  color: rgb(252, 165, 165);
}

@media (min-width: 640px) {
  .employee-import-file-row,
  .employee-import-simple-row,
  .employee-import-progress-head {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>