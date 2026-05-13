<!-- frontend/src/modules/org/components/EmployeeImportDialog.vue -->
<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import {
  downloadEmployeeImportSample,
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

const fileInputRef = ref(null)
const selectedFile = ref(null)
const downloading = ref(false)
const importing = ref(false)
const uploadProgress = ref(0)

const errorTitle = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const fileName = computed(() => selectedFile.value?.name || '')

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

function makeFriendlyImportMessage(error) {
  const text = getApiErrorMessage(error, t('org.employee.importFailed'))

  if (/Employee Code.*required|employeeCodeRequired/i.test(text)) {
    return `${text}. ${t('org.employee.employeeCodeRequiredHelp')}`
  }

  if (/joinDate|join date|Invalid Join Date/i.test(text)) {
    return `${text}. ${t('org.employee.joinDateFormatHelp')}`
  }

  if (/Department Code not found/i.test(text)) {
    return `${text}. ${t('org.employee.checkDepartmentMaster')}`
  }

  if (/Position Code not found/i.test(text)) {
    return `${text}. ${t('org.employee.checkPositionMaster')}`
  }

  if (/Position does not belong to Department/i.test(text)) {
    return `${text}. ${t('org.employee.positionDepartmentMismatchHelp')}`
  }

  if (/Line Code not found/i.test(text)) {
    return `${text}. ${t('org.employee.checkLineMaster')}`
  }

  if (/Shift Code not found/i.test(text)) {
    return `${text}. ${t('org.employee.checkShiftMaster')}`
  }

  if (/Reports To Employee Code not found|manager.*not found/i.test(text)) {
    return `${text}. ${t('org.employee.checkManagerEmployeeCode')}`
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
    errorMessage.value = makeFriendlyImportMessage(error)
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
    const res = await importEmployeesExcel(selectedFile.value, {
      onUploadProgress(event) {
        if (!event.total) return
        uploadProgress.value = Math.round((event.loaded * 100) / event.total)
      },
    })

    const payload = normalizeImportPayload(res)

    emit('success', payload)
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
    :header="t('org.employee.importTitle')"
    :style="{ width: '36rem', maxWidth: '96vw' }"
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
            <div class="font-semibold">
              {{ errorTitle || t('org.employee.importFailed') }}
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
        <div class="text-sm font-semibold text-[color:var(--ot-text)]">
          {{ t('org.employee.importGuideTitle') }}
        </div>

        <div class="mt-2 space-y-1 text-sm leading-6 text-[color:var(--ot-text-muted)]">
          <div>1. {{ t('org.employee.importGuideStep1') }}</div>
          <div>2. {{ t('org.employee.importGuideStep2') }}</div>
          <div>3. {{ t('org.employee.importGuideStep3') }}</div>
          <div>4. {{ t('org.employee.importGuideStep4') }}</div>
          <div>5. {{ t('org.employee.importGuideStep5') }}</div>
        </div>

        <div class="mt-4">
          <Button
            :label="t('org.employee.downloadSample')"
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
            <div class="text-sm font-semibold text-[color:var(--ot-text)]">
              {{ t('org.employee.excelFile') }}
            </div>

            <div class="mt-1 truncate text-sm text-[color:var(--ot-text-muted)]">
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