<!-- frontend/src/modules/org/components/LineImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import {
  downloadLineImportSample,
  importLinesExcel,
} from '@/modules/org/line.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'

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
const downloading = ref(false)
const importing = ref(false)
const processing = ref(false)
const uploadProgress = ref(0)

const errorTitle = ref('')
const errorMessage = ref('')
const errorRows = ref([])
const successMessage = ref('')

const fileName = computed(() => selectedFile.value?.name || '')
const hasImportErrors = computed(() => errorRows.value.length > 0)
const importErrorCount = computed(() => errorRows.value.length)

watch(
  () => props.visible,
  (value) => {
    if (!value) {
      resetState()
    }
  },
)

function resetState() {
  selectedFile.value = null
  uploadProgress.value = 0
  processing.value = false
  errorTitle.value = ''
  errorMessage.value = ''
  errorRows.value = []
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
  errorRows.value = []
  successMessage.value = ''
}

function triggerChooseFile() {
  clearMessage()
  fileInputRef.value?.click()
}

function onFileChange(event) {
  clearMessage()

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

    errorTitle.value = t('org.line.importInvalidFileTitle')
    errorMessage.value = t('org.line.importInvalidFileMessage')
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
    t('org.line.importUnknownError')

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
  downloading.value = true
  clearMessage()

  try {
    const res = await downloadLineImportSample()

    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, 'line-import-sample.xlsx'))
    successMessage.value = t('org.line.sampleDownloaded')
  } catch (error) {
    errorTitle.value = t('org.line.downloadSampleFailed')
    errorMessage.value = getApiErrorMessage(error, t('org.line.downloadSampleFailed'))
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  processing.value = false
  uploadProgress.value = 0
  clearMessage()

  try {
    const res = await importLinesExcel(selectedFile.value, {
      onUploadProgress(event) {
        if (!event.total) return

        uploadProgress.value = Math.round((event.loaded * 100) / event.total)

        if (uploadProgress.value >= 100) {
          processing.value = true
        }
      },
    })

    const payload = normalizeImportPayload(res)

    emit('success', payload)
    emit('update:visible', false)
  } catch (error) {
    const rows = getImportErrorRows(error)

    errorRows.value = rows
    errorTitle.value = rows.length
      ? t('org.line.importValidationFailed')
      : t('org.line.importFailed')
    errorMessage.value = getApiErrorMessage(error, t('org.line.importFailed'))
  } finally {
    importing.value = false
    processing.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('org.line.importTitle')"
    :style="{ width: '50rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="line-import-dialog">
      <div
        v-if="errorMessage"
        class="ot-inline-error"
      >
        <div class="line-import-message">
          <i class="pi pi-exclamation-triangle line-import-message__icon" />

          <div class="min-w-0 flex-1">
            <div class="line-import-message__title">
              {{ errorTitle || t('org.line.importFailed') }}
            </div>

            <div class="line-import-message__text">
              {{ errorMessage }}
            </div>

            <div
              v-if="hasImportErrors"
              class="line-import-error-count"
            >
              {{ t('org.line.importErrorCount', { count: importErrorCount }) }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="hasImportErrors"
        class="line-import-errors"
      >
        <div class="line-import-errors__header">
          <div>
            <div class="line-import-errors__title">
              {{ t('org.line.importErrorListTitle') }}
            </div>

            <div class="line-import-errors__subtitle">
              {{ t('org.line.importAllOrNothingNote') }}
            </div>
          </div>
        </div>

        <div class="line-import-errors__table-wrap">
          <table class="line-import-errors__table">
            <thead>
              <tr>
                <th>{{ t('org.line.importRow') }}</th>
                <th>{{ t('org.line.importField') }}</th>
                <th>{{ t('org.line.importValue') }}</th>
                <th>{{ t('org.line.importReason') }}</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="item in errorRows"
                :key="item.id"
              >
                <td>
                  <span class="line-import-row-badge">
                    {{ item.rowNo || '-' }}
                  </span>
                </td>

                <td>{{ item.field || '-' }}</td>

                <td>
                  <span class="line-import-value">
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
        <div class="line-import-message">
          <i class="pi pi-check-circle line-import-message__icon" />

          <div class="min-w-0">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <div class="ot-panel">
        <div class="text-sm font-semibold text-[color:var(--ot-text)]">
          {{ t('org.line.importGuideTitle') }}
        </div>

        <div class="mt-2 space-y-1 text-sm leading-6 text-[color:var(--ot-text-muted)]">
          <div>1. {{ t('org.line.importGuideStep1') }}</div>
          <div>2. {{ t('org.line.importGuideStep2') }}</div>
          <div>3. {{ t('org.line.importGuideStep3') }}</div>
          <div>4. {{ t('org.line.importGuideStep4') }}</div>
        </div>

        <div class="line-import-note">
          <i class="pi pi-shield" />
          <span>{{ t('org.line.importAllOrNothingNote') }}</span>
        </div>

        <div class="mt-4">
          <Button
            :label="t('org.line.downloadSample')"
            icon="pi pi-download"
            outlined
            severity="secondary"
            size="small"
            :loading="downloading"
            @click="handleDownloadSample"
          />
        </div>
      </div>

      <div class="line-import-file-box">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onFileChange"
        >

        <div class="line-import-file-row">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('org.line.excelFile') }}
            </div>

            <div class="mt-1 truncate text-sm text-[color:var(--ot-text-muted)]">
              {{ fileName || t('org.line.noFileSelected') }}
            </div>
          </div>

          <Button
            :label="t('org.line.chooseFile')"
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
        v-if="importing"
        class="line-import-progress"
      >
        <ProgressBar
          v-if="!processing"
          :value="uploadProgress"
          style="height: 6px"
        />

        <ProgressBar
          v-else
          mode="indeterminate"
          style="height: 6px"
        />

        <div class="line-import-progress__text">
          {{
            processing
              ? t('org.line.importProcessing')
              : t('org.line.importUploading', { percent: uploadProgress })
          }}
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
.line-import-dialog {
  display: grid;
  gap: 1rem;
}

.line-import-message {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.line-import-message__icon {
  margin-top: 0.16rem;
  flex: 0 0 auto;
}

.line-import-message__title {
  font-weight: 750;
}

.line-import-message__text {
  margin-top: 0.28rem;
  white-space: pre-line;
  line-height: 1.55;
}

.line-import-error-count {
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

.line-import-errors {
  overflow: hidden;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: 1rem;
  background: rgba(254, 242, 242, 0.72);
}

.line-import-errors__header {
  border-bottom: 1px solid rgba(220, 38, 38, 0.15);
  padding: 0.8rem 0.9rem;
}

.line-import-errors__title {
  color: rgb(127, 29, 29);
  font-size: 0.88rem;
  font-weight: 800;
}

.line-import-errors__subtitle {
  margin-top: 0.18rem;
  color: rgb(153, 27, 27);
  font-size: 0.76rem;
  line-height: 1.45;
}

.line-import-errors__table-wrap {
  max-height: 19rem;
  overflow: auto;
}

.line-import-errors__table {
  width: 100%;
  min-width: 44rem;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.line-import-errors__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(254, 226, 226);
  color: rgb(127, 29, 29);
  font-weight: 800;
  text-align: left;
}

.line-import-errors__table th,
.line-import-errors__table td {
  border-bottom: 1px solid rgba(220, 38, 38, 0.12);
  padding: 0.55rem 0.65rem;
  vertical-align: top;
}

.line-import-errors__table td {
  color: var(--ot-text);
  line-height: 1.45;
}

.line-import-row-badge {
  display: inline-flex;
  min-width: 2.1rem;
  justify-content: center;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.1);
  padding: 0.12rem 0.45rem;
  color: rgb(185, 28, 28);
  font-weight: 800;
}

.line-import-value {
  display: inline-block;
  max-width: 12rem;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.line-import-note {
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

.line-import-file-box {
  border: 1px dashed var(--ot-border);
  border-radius: 1rem;
  padding: 1rem;
}

.line-import-file-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.line-import-progress {
  display: grid;
  gap: 0.45rem;
}

.line-import-progress__text {
  color: var(--ot-text-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

:global(.dark) .line-import-error-count {
  background: rgba(248, 113, 113, 0.14);
  color: rgb(252, 165, 165);
}

:global(.dark) .line-import-errors {
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(127, 29, 29, 0.12);
}

:global(.dark) .line-import-errors__header {
  border-bottom-color: rgba(248, 113, 113, 0.22);
}

:global(.dark) .line-import-errors__title {
  color: rgb(252, 165, 165);
}

:global(.dark) .line-import-errors__subtitle {
  color: rgb(254, 202, 202);
}

:global(.dark) .line-import-errors__table th {
  background: rgb(69, 10, 10);
  color: rgb(254, 202, 202);
}

:global(.dark) .line-import-row-badge {
  background: rgba(248, 113, 113, 0.16);
  color: rgb(252, 165, 165);
}

:global(.dark) .line-import-note {
  background: rgba(96, 165, 250, 0.14);
  color: rgb(147, 197, 253);
}

@media (min-width: 640px) {
  .line-import-file-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>