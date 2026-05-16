<!-- frontend/src/modules/org/components/DepartmentImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import {
  downloadDepartmentImportSample,
  importDepartmentsExcel,
} from '@/modules/org/department.api'
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

    errorTitle.value = t('org.department.importInvalidFileTitle')
    errorMessage.value = t('org.department.importInvalidFileMessage')
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
    t('org.department.importUnknownError')

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
    const res = await downloadDepartmentImportSample()
    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    downloadBlob(blob, getFilenameFromHeader(res, 'department-import-sample.xlsx'))
    successMessage.value = t('org.department.sampleDownloaded')
  } catch (error) {
    errorTitle.value = t('org.department.downloadSampleFailed')
    errorMessage.value = getApiErrorMessage(error, t('org.department.downloadSampleFailed'))
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  uploadProgress.value = 0
  clearMessage()

  try {
    const res = await importDepartmentsExcel(selectedFile.value, {
      onUploadProgress(event) {
        if (!event.total) return
        uploadProgress.value = Math.round((event.loaded * 100) / event.total)
      },
    })

    const payload = normalizeImportPayload(res)

    emit('success', payload)

    // Auto close only when import succeeds
    emit('update:visible', false)
  } catch (error) {
    const rows = getImportErrorRows(error)

    errorRows.value = rows
    errorTitle.value = rows.length
      ? t('org.department.importValidationFailed')
      : t('org.department.importFailed')
    errorMessage.value = getApiErrorMessage(error, t('org.department.importFailed'))
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="t('org.department.importTitle')"
    :style="{ width: '46rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="department-import-dialog">
      <div
        v-if="errorMessage"
        class="ot-inline-error"
      >
        <div class="department-import-message">
          <i class="pi pi-exclamation-triangle department-import-message__icon" />

          <div class="min-w-0 flex-1">
            <div class="department-import-message__title">
              {{ errorTitle || t('org.department.importFailed') }}
            </div>

            <div class="department-import-message__text">
              {{ errorMessage }}
            </div>

            <div
              v-if="hasImportErrors"
              class="department-import-error-count"
            >
              {{ t('org.department.importErrorCount', { count: importErrorCount }) }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="hasImportErrors"
        class="department-import-errors"
      >
        <div class="department-import-errors__header">
          <div>
            <div class="department-import-errors__title">
              {{ t('org.department.importErrorListTitle') }}
            </div>

            <div class="department-import-errors__subtitle">
              {{ t('org.department.importAllOrNothingNote') }}
            </div>
          </div>
        </div>

        <div class="department-import-errors__table-wrap">
          <table class="department-import-errors__table">
            <thead>
              <tr>
                <th>{{ t('org.department.importRow') }}</th>
                <th>{{ t('org.department.importField') }}</th>
                <th>{{ t('org.department.importValue') }}</th>
                <th>{{ t('org.department.importReason') }}</th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="item in errorRows"
                :key="item.id"
              >
                <td>
                  <span class="department-import-row-badge">
                    {{ item.rowNo || '-' }}
                  </span>
                </td>

                <td>
                  {{ item.field || '-' }}
                </td>

                <td>
                  <span class="department-import-value">
                    {{ item.value || '-' }}
                  </span>
                </td>

                <td>
                  {{ item.reason || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="successMessage"
        class="ot-inline-info"
      >
        <div class="department-import-message">
          <i class="pi pi-check-circle department-import-message__icon" />

          <div class="min-w-0">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <div class="ot-panel">
        <div class="text-sm font-semibold text-[color:var(--ot-text)]">
          {{ t('org.department.importGuideTitle') }}
        </div>

        <div class="mt-2 space-y-1 text-sm leading-6 text-[color:var(--ot-text-muted)]">
          <div>1. {{ t('org.department.importGuideStep1') }}</div>
          <div>2. {{ t('org.department.importGuideStep2') }}</div>
          <div>3. {{ t('org.department.importGuideStep3') }}</div>
          <div>4. {{ t('org.department.importGuideStep4') }}</div>
        </div>

        <div class="department-import-note">
          <i class="pi pi-shield" />
          <span>{{ t('org.department.importAllOrNothingNote') }}</span>
        </div>

        <div class="mt-4">
          <Button
            :label="t('org.department.downloadSample')"
            icon="pi pi-download"
            outlined
            severity="secondary"
            size="small"
            :loading="downloading"
            @click="handleDownloadSample"
          />
        </div>
      </div>

      <div class="department-import-file-box">
        <input
          ref="fileInputRef"
          type="file"
          accept=".xlsx,.xls,.csv"
          class="hidden"
          @change="onFileChange"
        >

        <div class="department-import-file-row">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('org.department.excelFile') }}
            </div>

            <div class="mt-1 truncate text-sm text-[color:var(--ot-text-muted)]">
              {{ fileName || t('org.department.noFileSelected') }}
            </div>
          </div>

          <Button
            :label="t('org.department.chooseFile')"
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
          :disabled="!selectedFile || importing"
          :loading="importing"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.department-import-dialog {
  display: grid;
  gap: 1rem;
}

.department-import-message {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.department-import-message__icon {
  margin-top: 0.16rem;
  flex: 0 0 auto;
}

.department-import-message__title {
  font-weight: 750;
}

.department-import-message__text {
  margin-top: 0.28rem;
  white-space: pre-line;
  line-height: 1.55;
}

.department-import-error-count {
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

.department-import-errors {
  overflow: hidden;
  border: 1px solid rgba(220, 38, 38, 0.18);
  border-radius: 1rem;
  background: rgba(254, 242, 242, 0.72);
}

.department-import-errors__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  border-bottom: 1px solid rgba(220, 38, 38, 0.15);
  padding: 0.8rem 0.9rem;
}

.department-import-errors__title {
  color: rgb(127, 29, 29);
  font-size: 0.88rem;
  font-weight: 800;
}

.department-import-errors__subtitle {
  margin-top: 0.18rem;
  color: rgb(153, 27, 27);
  font-size: 0.76rem;
  line-height: 1.45;
}

.department-import-errors__table-wrap {
  max-height: 19rem;
  overflow: auto;
}

.department-import-errors__table {
  width: 100%;
  min-width: 42rem;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.department-import-errors__table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgb(254, 226, 226);
  color: rgb(127, 29, 29);
  font-weight: 800;
  text-align: left;
}

.department-import-errors__table th,
.department-import-errors__table td {
  border-bottom: 1px solid rgba(220, 38, 38, 0.12);
  padding: 0.55rem 0.65rem;
  vertical-align: top;
}

.department-import-errors__table td {
  color: var(--ot-text);
  line-height: 1.45;
}

.department-import-row-badge {
  display: inline-flex;
  min-width: 2.1rem;
  justify-content: center;
  border-radius: 999px;
  background: rgba(220, 38, 38, 0.1);
  padding: 0.12rem 0.45rem;
  color: rgb(185, 28, 28);
  font-weight: 800;
}

.department-import-value {
  display: inline-block;
  max-width: 12rem;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.department-import-note {
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

.department-import-file-box {
  border: 1px dashed var(--ot-border);
  border-radius: 1rem;
  padding: 1rem;
}

.department-import-file-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

:global(.dark) .department-import-error-count {
  background: rgba(248, 113, 113, 0.14);
  color: rgb(252, 165, 165);
}

:global(.dark) .department-import-errors {
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(127, 29, 29, 0.12);
}

:global(.dark) .department-import-errors__header {
  border-bottom-color: rgba(248, 113, 113, 0.22);
}

:global(.dark) .department-import-errors__title {
  color: rgb(252, 165, 165);
}

:global(.dark) .department-import-errors__subtitle {
  color: rgb(254, 202, 202);
}

:global(.dark) .department-import-errors__table th {
  background: rgb(69, 10, 10);
  color: rgb(254, 202, 202);
}

:global(.dark) .department-import-row-badge {
  background: rgba(248, 113, 113, 0.16);
  color: rgb(252, 165, 165);
}

:global(.dark) .department-import-note {
  background: rgba(96, 165, 250, 0.14);
  color: rgb(147, 197, 253);
}

@media (min-width: 640px) {
  .department-import-file-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}
</style>