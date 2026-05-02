<!-- frontend/src/modules/org/components/EmployeeImportDialog.vue -->
<script setup>
// frontend/src/modules/org/components/EmployeeImportDialog.vue

import { computed, ref, watch } from 'vue'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ProgressBar from 'primevue/progressbar'

import {
  downloadEmployeeImportSample,
  importEmployeesExcel,
} from '@/modules/org/employee.api'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:visible', 'success'])

const fileInputRef = ref(null)
const selectedFile = ref(null)
const downloading = ref(false)
const importing = ref(false)

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
  errorTitle.value = ''
  errorMessage.value = ''
  successMessage.value = ''

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function closeDialog() {
  emit('update:visible', false)
}

function triggerChooseFile() {
  clearMessage()
  fileInputRef.value?.click()
}

function clearMessage() {
  errorTitle.value = ''
  errorMessage.value = ''
  successMessage.value = ''
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

    errorTitle.value = 'Invalid file type'
    errorMessage.value = 'Please choose an Excel file only: .xlsx, .xls, or .csv.'
    return
  }

  selectedFile.value = file
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function getErrorText(error) {
  const data = error?.response?.data

  if (typeof data === 'string') {
    return data
  }

  if (data instanceof Blob) {
    return 'Import failed. Please check the Excel file and try again.'
  }

  return (
    data?.message ||
    data?.error ||
    error?.message ||
    'Import failed. Please check the Excel file and try again.'
  )
}

function getErrorTitle(error) {
  const status = Number(error?.response?.status || 0)

  if (status === 400) return 'Invalid Excel Data'
  if (status === 401) return 'Login Required'
  if (status === 403) return 'No Permission'
  if (status === 404) return 'Import API Not Found'
  if (status === 409) return 'Duplicate Data'
  if (status >= 500) return 'Server Error'

  return 'Import Failed'
}

function makeFriendlyImportMessage(message) {
  const text = String(message || '').trim()

  if (!text) {
    return 'Please check the Excel file and try again.'
  }

  if (/joinDate|join date/i.test(text)) {
    if (/dd\/mm\/yyyy/i.test(text)) {
      return text
    }

    return `${text}. Please use DD/MM/YYYY format, for example 30/11/2012.`
  }

  if (/Department Code not found/i.test(text)) {
    return `${text}. Please check Department master first.`
  }

  if (/Position Code not found/i.test(text)) {
    return `${text}. Please check Position master first.`
  }

  if (/Position does not belong to Department/i.test(text)) {
    return `${text}. Please make sure the Position Code belongs to the selected Department Code.`
  }

  if (/Line Code not found/i.test(text)) {
    return `${text}. Please check Line master first.`
  }

  if (/Shift Code not found/i.test(text)) {
    return `${text}. Please check Shift master first and make sure the shift is active.`
  }

  if (/Duplicate Employee No/i.test(text)) {
    return `${text}. Please remove duplicate Employee No from the Excel file.`
  }

  if (/Email already exists/i.test(text)) {
    return `${text}. Please use a unique email or leave the email blank.`
  }

  if (/Reports To Employee No not found/i.test(text)) {
    return `${text}. Please import the manager first or use an existing manager Employee No.`
  }

  return text
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

    downloadBlob(blob, 'employee-import-sample.xlsx')
    successMessage.value = 'Sample file downloaded successfully.'
  } catch (error) {
    errorTitle.value = getErrorTitle(error)
    errorMessage.value = makeFriendlyImportMessage(getErrorText(error))
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  importing.value = true
  clearMessage()

  try {
    const res = await importEmployeesExcel(selectedFile.value)
    const payload = normalizePayload(res)

    const created = payload?.summary?.created || 0
    const updated = payload?.summary?.updated || 0

    successMessage.value = `Import completed successfully. Created: ${created}, Updated: ${updated}.`

    emit('success', payload)
    closeDialog()
  } catch (error) {
    errorTitle.value = getErrorTitle(error)
    errorMessage.value = makeFriendlyImportMessage(getErrorText(error))
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Import Employee Excel"
    :style="{ width: '34rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div
        v-if="errorMessage"
        class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
      >
        <div class="flex items-start gap-3">
          <i class="pi pi-exclamation-triangle mt-0.5 text-red-500" />

          <div class="min-w-0">
            <div class="text-sm font-semibold">
              {{ errorTitle || 'Import Failed' }}
            </div>

            <div class="mt-1 whitespace-pre-line text-sm leading-6">
              {{ errorMessage }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="successMessage"
        class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <div class="flex items-start gap-3">
          <i class="pi pi-check-circle mt-0.5 text-emerald-500" />

          <div class="min-w-0 text-sm font-medium leading-6">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-4">
        <div class="text-sm font-semibold text-[color:var(--ot-text)]">
          Import guide
        </div>

        <div class="mt-2 space-y-1 text-sm text-[color:var(--ot-text-muted)]">
          <div>1. Download the sample file.</div>
          <div>2. Fill your employee data in the same format.</div>
          <div>3. Join Date format must be DD/MM/YYYY, example 30/11/2012.</div>
          <div>4. Department, Position, Line, and Shift must already exist in master data.</div>
          <div>5. Choose the completed Excel file, then click Import.</div>
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

      <ProgressBar
        v-if="importing"
        mode="indeterminate"
        style="height: 6px"
      />

      <div class="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        If import fails, the exact row number and reason will show above.
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
          :disabled="!selectedFile || importing"
          :loading="importing"
          @click="handleImport"
        />
      </div>
    </template>
  </Dialog>
</template>