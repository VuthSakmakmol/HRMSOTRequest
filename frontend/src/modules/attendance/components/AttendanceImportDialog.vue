<!-- frontend/src/modules/attendance/components/AttendanceImportDialog.vue -->
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'

import {
  downloadAttendanceImportSample,
  importAttendanceFile,
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
const downloading = ref(false)
const importing = ref(false)

const form = reactive({
  periodFrom: '',
  periodTo: '',
  remark: '',
})

const fileName = computed(() => selectedFile.value?.name || '')
const canImport = computed(() => !!selectedFile.value && !importing.value)

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
  form.periodFrom = ''
  form.periodTo = ''
  form.remark = ''

  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

function closeDialog() {
  emit('update:visible', false)
}

function triggerChooseFile() {
  fileInputRef.value?.click()
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
    const res = await downloadAttendanceImportSample()
    const blob = new Blob([res.data], {
      type:
        res?.headers?.['content-type'] ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    downloadBlob(blob, 'attendance-import-sample.xlsx')
  } catch (error) {
    console.error(error)
    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to download attendance sample',
      life: 3000,
    })
  } finally {
    downloading.value = false
  }
}

async function handleImport() {
  if (!selectedFile.value || importing.value) return

  if (form.periodFrom && form.periodTo && form.periodFrom > form.periodTo) {
    toast.add({
      severity: 'warn',
      summary: 'Invalid period',
      detail: 'Period To must be greater than or equal to Period From',
      life: 2500,
    })
    return
  }

  importing.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    if (form.periodFrom) formData.append('periodFrom', form.periodFrom)
    if (form.periodTo) formData.append('periodTo', form.periodTo)
    if (String(form.remark || '').trim()) {
      formData.append('remark', String(form.remark).trim())
    }

    const res = await importAttendanceFile(formData)

    emit('success', res?.data)

    toast.add({
      severity: 'success',
      summary: 'Import completed',
      detail: 'Attendance file imported successfully',
      life: 2500,
    })

    closeDialog()
  } catch (error) {
    console.error(error)
    toast.add({
      severity: 'error',
      summary: 'Import failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to import attendance file',
      life: 3500,
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
    header="Import Attendance Excel"
    :style="{ width: '36rem', maxWidth: '96vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="space-y-4">
      <div class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-4">
        <div class="flex flex-wrap items-center gap-2">
          <div class="text-sm font-semibold text-[color:var(--ot-text)]">
            Import guide
          </div>
          <Tag value="Excel Sample" severity="info" />
        </div>

        <div class="mt-2 space-y-1 text-sm text-[color:var(--ot-text-muted)]">
          <div>1. Download the sample file.</div>
          <div>2. Fill your attendance data in the same format.</div>
          <div>3. Required columns: Employee ID, Employee Name, Attendance Date, Clock In, Clock Out, Status, Position, Department, Shift.</div>
          <div>4. Employee ID maps to Employee master employeeNo.</div>
          <div>5. Department / Position / Shift are checked against Employee master for validation.</div>
          <div>6. Night shift rows are validated against assigned shift time.</div>
          <div>7. Choose the completed Excel file from your computer.</div>
          <div>8. Click Import to upload and process it.</div>
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
            @click="triggerChooseFile"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Period From
          </label>
          <input
            v-model="form.periodFrom"
            type="date"
            class="h-10 w-full rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 text-sm text-[color:var(--ot-text)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
          >
        </div>

        <div class="space-y-1.5">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Period To
          </label>
          <input
            v-model="form.periodTo"
            type="date"
            class="h-10 w-full rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 text-sm text-[color:var(--ot-text)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
          >
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-sm font-medium text-[color:var(--ot-text)]">
          Remark
        </label>
        <textarea
          v-model="form.remark"
          rows="3"
          class="w-full rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-sm text-[color:var(--ot-text)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-900"
          placeholder="Optional note about this import"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          label="Cancel"
          text
          size="small"
          @click="closeDialog"
        />
        <Button
          label="Import"
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