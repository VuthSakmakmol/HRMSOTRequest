<!-- frontend/src/modules/payment/views/PaymentProcessView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentProcessView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { getHolidays } from '@/modules/calendar/holiday.api'

import {
  calculatePaymentExport,
  downloadSalaryTemplate,
  getPaymentFormulaLookupOptions,
  previewPayment,
} from '@/modules/payment/payment.api'

const toast = useToast()

const formulaOptions = ref([])
const loadingFormulas = ref(false)
const downloadingTemplate = ref(false)
const previewing = ref(false)
const generating = ref(false)

const loadingCalendar = ref(false)
const periodHolidayRows = ref([])

const salaryFile = ref(null)
const salaryFileInput = ref(null)

const previewDone = ref(false)
const previewResult = ref(null)

const form = reactive({
  fromDate: null,
  toDate: null,
  formulaId: '',
})

let calendarTimer = null

const selectedFormula = computed(() => {
  const id = String(form.formulaId || '')
  return formulaOptions.value.find((item) => String(item.id || item._id) === id) || null
})

const canPreview = computed(() => {
  return Boolean(form.fromDate && form.toDate && form.formulaId && salaryFile.value)
})

const canGenerate = computed(() => {
  return canPreview.value && previewDone.value && previewResult.value
})

const fileName = computed(() => salaryFile.value?.name || '')

const previewSummary = computed(() => previewResult.value?.summary || null)
const previewData = computed(() => previewResult.value?.preview || {})

const periodStartYMD = computed(() => formatDateYMD(form.fromDate))
const periodEndYMD = computed(() => formatDateYMD(form.toDate))

const holidayDateSet = computed(() => {
  return new Set(
    periodHolidayRows.value
      .map((item) => String(item?.date || '').trim())
      .filter(Boolean),
  )
})

const periodCalendarRows = computed(() => {
  const start = parseYMD(periodStartYMD.value)
  const end = parseYMD(periodEndYMD.value)

  if (!start || !end || start > end) return []

  const rows = []
  const cursor = new Date(start)

  while (cursor <= end) {
    const ymd = formatDateYMD(cursor)
    const holiday = periodHolidayRows.value.find((item) => item.date === ymd) || null

    rows.push({
      date: ymd,
      dayName: cursor.toLocaleDateString('en-US', { weekday: 'short' }),
      dayType: getFrontendDayType(ymd),
      holidayName: holiday?.name || '',
      holidayCode: holiday?.code || '',
      isPaidHoliday: holiday?.isPaidHoliday === true,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return rows
})

const periodCalendarSummary = computed(() => {
  const rows = periodCalendarRows.value

  return {
    workingDays: rows.filter((row) => row.dayType === 'WORKING_DAY').length,
    sundays: rows.filter((row) => row.dayType === 'SUNDAY').length,
    holidays: rows.filter((row) => row.dayType === 'HOLIDAY').length,
  }
})

const summaryCards = computed(() => {
  const summary = previewSummary.value

  return [
    {
      label: 'Payable Employees',
      value: summary ? summary.employeeCount : '-',
      icon: 'pi pi-users',
      className: 'card-blue',
    },
    {
      label: 'Total OT Hours',
      value: summary ? formatNumber(summary.totalPayableHours, 4) : '-',
      icon: 'pi pi-clock',
      className: 'card-green',
    },
    {
      label: 'Total Amount',
      value: summary
        ? `${formatNumber(summary.totalAmount, 2)} ${summary.currency || ''}`
        : '-',
      icon: 'pi pi-wallet',
      className: 'card-purple',
    },
    {
      label: 'Missing Salary',
      value: summary ? summary.missingSalaryCount : '-',
      icon: 'pi pi-exclamation-triangle',
      className: 'card-orange',
    },
    {
      label: 'Warnings',
      value: summary ? summary.warningCount : '-',
      icon: 'pi pi-info-circle',
      className: 'card-red',
    },
  ]
})

watch(
  () => [periodStartYMD.value, periodEndYMD.value, form.formulaId],
  () => {
    resetPreview()
    scheduleCalendarLoad()
  },
)

function pad2(value) {
  return String(value).padStart(2, '0')
}

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function formatDateYMD(value) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseYMD(value) {
  const raw = s(value)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateDMY(value) {
  if (!value) return '-'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatNumber(value, decimals = 2) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return '0'
  if (Number.isInteger(number)) return String(number)

  return number.toFixed(decimals).replace(/\.?0+$/, '')
}

function formatMinutesLabel(value) {
  const minutes = Math.max(0, Number(value || 0))

  if (!minutes) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function errorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  )
}

function parseDownloadFileName(response, fallback) {
  const disposition = response?.headers?.['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/i)
  return match?.[1] || fallback
}

function downloadBlob(response, fallbackFileName) {
  const blob = new Blob([response.data], {
    type:
      response.headers?.['content-type'] ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = parseDownloadFileName(response, fallbackFileName)
  document.body.appendChild(link)
  link.click()
  link.remove()

  window.URL.revokeObjectURL(url)
}

function resetPreview() {
  previewDone.value = false
  previewResult.value = null
}

function buildFormData() {
  const formData = new FormData()

  formData.append('fromDate', periodStartYMD.value)
  formData.append('toDate', periodEndYMD.value)
  formData.append('formulaId', form.formulaId)
  formData.append('salaryFile', salaryFile.value)

  return formData
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function getMonthKeysBetween(fromYMD, toYMD) {
  const start = parseYMD(fromYMD)
  const end = parseYMD(toYMD)

  if (!start || !end || start > end) return []

  const keys = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cursor <= last) {
    keys.push(monthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return keys
}

function getFrontendDayType(ymd) {
  if (!ymd) return ''

  if (holidayDateSet.value.has(ymd)) {
    return 'HOLIDAY'
  }

  const date = parseYMD(ymd)
  if (!date) return ''

  return date.getDay() === 0 ? 'SUNDAY' : 'WORKING_DAY'
}

function dayTypeSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function dayTypeLabel(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'Holiday'
  if (normalized === 'SUNDAY') return 'Sunday'
  if (normalized === 'WORKING_DAY') return 'Working Day'

  return normalized || '-'
}

function decisionSeverity(value) {
  const normalized = upper(value)

  if (['MATCH', 'APPROVED_WITHOUT_EXACT_CLOCK_OUT', 'FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT'].includes(normalized)) {
    return 'success'
  }

  if (['SHORT', 'BELOW_MIN', 'PENDING_REVIEW'].includes(normalized)) {
    return 'warning'
  }

  if (['MISMATCH', 'NOT_ELIGIBLE', 'ATTENDANCE_NOT_PRESENT'].includes(normalized)) {
    return 'danger'
  }

  return 'secondary'
}

async function loadFormulaOptions() {
  loadingFormulas.value = true

  try {
    const res = await getPaymentFormulaLookupOptions({
      isActive: true,
      limit: 100,
    })

    const payload = normalizePayload(res)
    formulaOptions.value = normalizeItems(payload)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail: errorMessage(error, 'Failed to load payment formulas'),
      life: 3000,
    })
  } finally {
    loadingFormulas.value = false
  }
}

function scheduleCalendarLoad() {
  window.clearTimeout(calendarTimer)

  calendarTimer = window.setTimeout(() => {
    loadInternalCalendarForPeriod()
  }, 250)
}

async function loadInternalCalendarForPeriod() {
  const from = periodStartYMD.value
  const to = periodEndYMD.value

  if (!from || !to || from > to) {
    periodHolidayRows.value = []
    return
  }

  const monthKeys = getMonthKeysBetween(from, to)

  if (!monthKeys.length) {
    periodHolidayRows.value = []
    return
  }

  loadingCalendar.value = true

  try {
    const responses = await Promise.all(
      monthKeys.map((key) => {
        const [year, month] = key.split('-')

        return getHolidays({
          page: 1,
          limit: 100,
          search: '',
          isActive: true,
          year,
          month,
          sortBy: 'date',
          sortOrder: 'asc',
        })
      }),
    )

    const rows = responses.flatMap((res) => {
      const payload = normalizePayload(res)
      return normalizeItems(payload)
    })

    const uniqueMap = new Map()

    for (const item of rows) {
      const date = s(item?.date)

      if (!date || date < from || date > to) continue

      uniqueMap.set(date, {
        ...item,
        date,
      })
    }

    periodHolidayRows.value = [...uniqueMap.values()].sort((a, b) => {
      return String(a.date || '').localeCompare(String(b.date || ''))
    })
  } catch (error) {
    periodHolidayRows.value = []

    toast.add({
      severity: 'error',
      summary: 'Calendar failed',
      detail: errorMessage(error, 'Failed to load internal holiday calendar'),
      life: 3500,
    })
  } finally {
    loadingCalendar.value = false
  }
}

function chooseFile() {
  salaryFileInput.value?.click()
}

function onFileChange(event) {
  const file = event?.target?.files?.[0] || null

  resetPreview()

  if (!file) {
    salaryFile.value = null
    return
  }

  const allowedExtensions = ['.xlsx', '.xls']
  const lowerName = String(file.name || '').toLowerCase()
  const isExcel = allowedExtensions.some((ext) => lowerName.endsWith(ext))

  if (!isExcel) {
    salaryFile.value = null
    if (salaryFileInput.value) salaryFileInput.value.value = ''

    toast.add({
      severity: 'warn',
      summary: 'Invalid file',
      detail: 'Please upload Excel file only: .xlsx or .xls',
      life: 3000,
    })
    return
  }

  salaryFile.value = file
}

function clearFile() {
  salaryFile.value = null
  if (salaryFileInput.value) salaryFileInput.value.value = ''
  resetPreview()
}

function clearForm() {
  form.fromDate = null
  form.toDate = null
  form.formulaId = ''
  clearFile()
  periodHolidayRows.value = []
  resetPreview()
}

async function handleDownloadTemplate() {
  downloadingTemplate.value = true

  try {
    const res = await downloadSalaryTemplate()
    downloadBlob(res, 'salary_template.xlsx')

    toast.add({
      severity: 'success',
      summary: 'Downloaded',
      detail: 'Salary template downloaded',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Download failed',
      detail: errorMessage(error, 'Failed to download salary template'),
      life: 3500,
    })
  } finally {
    downloadingTemplate.value = false
  }
}

function validateBeforeProcess() {
  if (!form.fromDate) return 'From date is required'
  if (!form.toDate) return 'To date is required'
  if (!form.formulaId) return 'Payment formula is required'
  if (!salaryFile.value) return 'Salary Excel file is required'

  const from = new Date(form.fromDate)
  const to = new Date(form.toDate)

  if (from > to) return 'From date cannot be after To date'

  return ''
}

async function handlePreview() {
  const validationMessage = validateBeforeProcess()

  if (validationMessage) {
    toast.add({
      severity: 'warn',
      summary: 'Check form',
      detail: validationMessage,
      life: 3000,
    })
    return
  }

  previewing.value = true
  resetPreview()

  try {
    const res = await previewPayment(buildFormData())
    const payload = normalizePayload(res)

    previewResult.value = payload
    previewDone.value = true

    toast.add({
      severity: 'success',
      summary: 'Preview ready',
      detail: 'Payment preview calculated successfully',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Preview failed',
      detail: errorMessage(error, 'Failed to calculate payment preview'),
      life: 4000,
    })
  } finally {
    previewing.value = false
  }
}

async function handleGenerate() {
  const validationMessage = validateBeforeProcess()

  if (validationMessage) {
    toast.add({
      severity: 'warn',
      summary: 'Check form',
      detail: validationMessage,
      life: 3000,
    })
    return
  }

  if (!previewDone.value) {
    toast.add({
      severity: 'warn',
      summary: 'Preview required',
      detail: 'Please preview the payment before generating Excel',
      life: 3000,
    })
    return
  }

  generating.value = true

  try {
    const res = await calculatePaymentExport(buildFormData())

    const from = periodStartYMD.value
    const to = periodEndYMD.value

    downloadBlob(res, `payment_${from}_to_${to}.xlsx`)

    toast.add({
      severity: 'success',
      summary: 'Generated',
      detail: 'Payment Excel generated successfully',
      life: 3000,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Generate failed',
      detail: errorMessage(error, 'Failed to generate payment Excel'),
      life: 4000,
    })
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  loadFormulaOptions()
  loadInternalCalendarForPeriod()
})

onBeforeUnmount(() => {
  window.clearTimeout(calendarTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <!-- Filter/action bar -->
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="form.fromDate"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="From Date"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="form.toDate"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="To Date"
            />
          </div>

          <div class="w-full xl:w-[280px] xl:shrink-0">
            <Select
              v-model="form.formulaId"
              :options="formulaOptions"
              optionLabel="label"
              optionValue="id"
              :loading="loadingFormulas"
              placeholder="Payment Formula"
              class="w-full"
              size="small"
            />
          </div>

          <input
            ref="salaryFileInput"
            type="file"
            accept=".xlsx,.xls"
            class="hidden"
            @change="onFileChange"
          />

          <Button
            :label="fileName ? 'Change File' : 'Upload Salary'"
            icon="pi pi-upload"
            severity="secondary"
            outlined
            size="small"
            class="xl:shrink-0"
            @click="chooseFile"
          />

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <Button
              label="Template"
              icon="pi pi-download"
              severity="secondary"
              outlined
              size="small"
              :loading="downloadingTemplate"
              @click="handleDownloadTemplate"
            />

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              :disabled="previewing || generating"
              @click="clearForm"
            />

            <Button
              label="Preview"
              icon="pi pi-eye"
              severity="info"
              size="small"
              :loading="previewing"
              :disabled="!canPreview || generating"
              @click="handlePreview"
            />

            <Button
              label="Generate"
              icon="pi pi-file-excel"
              size="small"
              :loading="generating"
              :disabled="!canGenerate || previewing"
              @click="handleGenerate"
            />
          </div>
        </div>
      </div>

      <!-- Main body -->
      <div class="grid grid-cols-1 gap-3 p-3 xl:grid-cols-[1fr_1fr]">
        <div class="payment-card">
          <div class="payment-card-header">
            <div>
              <h2 class="payment-title">Payment Processing</h2>
              <p class="payment-subtitle">
                Preview first, then generate final OT payment Excel.
              </p>
            </div>

            <Tag
              :value="previewDone ? 'Preview Ready' : 'Not Previewed'"
              :severity="previewDone ? 'success' : 'warning'"
              class="payment-tag"
            />
          </div>

          <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div class="payment-info-box">
              <div class="payment-info-label">From Date</div>
              <div class="payment-info-value">{{ formatDateDMY(form.fromDate) }}</div>
            </div>

            <div class="payment-info-box">
              <div class="payment-info-label">To Date</div>
              <div class="payment-info-value">{{ formatDateDMY(form.toDate) }}</div>
            </div>

            <div class="payment-info-box md:col-span-2">
              <div class="payment-info-label">Salary Excel</div>

              <div class="flex min-w-0 items-center justify-between gap-2">
                <div class="payment-info-value truncate">
                  {{ fileName || 'No file selected' }}
                </div>

                <Button
                  v-if="salaryFile"
                  icon="pi pi-times"
                  text
                  rounded
                  severity="danger"
                  size="small"
                  @click="clearFile"
                />
              </div>
            </div>
          </div>

          <Message severity="warn" :closable="false" class="mt-3">
            Salary file, preview result, and final payment file are not saved.
            If download fails, upload salary again and generate again.
          </Message>
        </div>

        <div class="payment-card">
          <div class="payment-card-header">
            <div>
              <h2 class="payment-title">Formula Preview</h2>
              <p class="payment-subtitle">
                Formula selected for this payment calculation.
              </p>
            </div>

            <Tag
              :value="selectedFormula ? 'Ready' : 'Select Formula'"
              :severity="selectedFormula ? 'success' : 'secondary'"
              class="payment-tag"
            />
          </div>

          <div v-if="selectedFormula" class="mt-3 space-y-2">
            <div class="payment-info-box">
              <div class="payment-info-label">Formula</div>
              <div class="payment-info-value">
                {{ selectedFormula.label || selectedFormula.name }}
              </div>
            </div>

            <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div class="payment-info-box">
                <div class="payment-info-label">Working Days</div>
                <div class="payment-info-value">
                  {{ selectedFormula.monthlyWorkingDays }} / month
                </div>
              </div>

              <div class="payment-info-box">
                <div class="payment-info-label">Hours Per Day</div>
                <div class="payment-info-value">
                  {{ selectedFormula.hoursPerDay }} hours
                </div>
              </div>
            </div>

            <div class="payment-info-box">
              <div class="payment-info-label">Multipliers</div>

              <div class="mt-2 flex flex-wrap gap-1.5">
                <Tag
                  :value="`Working ${formatNumber(selectedFormula.multipliers?.WORKING_DAY)}x`"
                  severity="success"
                  class="payment-tag payment-day-working"
                />
                <Tag
                  :value="`Sunday ${formatNumber(selectedFormula.multipliers?.SUNDAY)}x`"
                  severity="warning"
                  class="payment-tag payment-day-sunday"
                />
                <Tag
                  :value="`Holiday ${formatNumber(selectedFormula.multipliers?.HOLIDAY)}x`"
                  severity="danger"
                  class="payment-tag payment-day-holiday"
                />
              </div>
            </div>

            <div class="payment-formula-box">
              <div class="payment-info-label">Calculation</div>
              <div class="mt-1 text-xs font-medium text-[color:var(--ot-text)]">
                Hourly Rate = Monthly Salary ÷ Working Days ÷ Hours Per Day
              </div>
              <div class="mt-1 text-xs font-medium text-[color:var(--ot-text)]">
                OT Amount = Payable OT Hours × Hourly Rate × Day Type Multiplier
              </div>
            </div>
          </div>

          <div v-else class="payment-empty-box">
            <i class="pi pi-calculator text-xl" />
            <div class="mt-2 text-sm font-semibold">No formula selected</div>
            <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
              Select an active payment formula before preview.
            </div>
          </div>
        </div>
      </div>

      <!-- Internal Calendar Preview -->
      <div class="border-t border-[color:var(--ot-border)] p-3">
        <div class="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="payment-section-title">Internal Calendar Check</h2>
            <p class="payment-section-subtitle">
              Frontend displays active holidays from Calendar module. Backend payment still recalculates the official day type.
            </p>
          </div>

          <Tag
            :value="loadingCalendar ? 'Loading Calendar' : `${periodHolidayRows.length} holidays`"
            :severity="loadingCalendar ? 'info' : 'secondary'"
            class="payment-tag"
          />
        </div>

        <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div class="summary-card card-green">
            <div class="summary-icon">
              <i class="pi pi-briefcase" />
            </div>
            <div>
              <div class="summary-label">Working Days</div>
              <div class="summary-value">{{ periodCalendarSummary.workingDays }}</div>
            </div>
          </div>

          <div class="summary-card card-orange">
            <div class="summary-icon">
              <i class="pi pi-sun" />
            </div>
            <div>
              <div class="summary-label">Sundays</div>
              <div class="summary-value">{{ periodCalendarSummary.sundays }}</div>
            </div>
          </div>

          <div class="summary-card card-red">
            <div class="summary-icon">
              <i class="pi pi-star" />
            </div>
            <div>
              <div class="summary-label">Internal Holidays</div>
              <div class="summary-value">{{ periodCalendarSummary.holidays }}</div>
            </div>
          </div>
        </div>

        <div
          v-if="periodHolidayRows.length"
          class="mt-3 flex flex-wrap gap-2"
        >
          <Tag
            v-for="holiday in periodHolidayRows"
            :key="holiday.id || holiday.date"
            :value="`${holiday.date} · ${holiday.name}`"
            severity="danger"
            class="payment-tag"
          />
        </div>
      </div>

      <!-- Preview Summary -->
      <div
        v-if="previewResult"
        class="border-t border-[color:var(--ot-border)] p-3"
      >
        <div class="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="payment-section-title">Payment Preview</h2>
            <p class="payment-section-subtitle">
              Review the calculated result before generating Excel.
            </p>
          </div>

          <div class="text-xs font-medium text-[color:var(--ot-text-muted)]">
            Preview rows are not saved in database.
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div
            v-for="card in summaryCards"
            :key="card.label"
            class="summary-card"
            :class="card.className"
          >
            <div class="summary-icon">
              <i :class="card.icon" />
            </div>

            <div class="min-w-0">
              <div class="summary-label">{{ card.label }}</div>
              <div class="summary-value truncate">{{ card.value }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview Tables -->
      <div
        v-if="previewResult"
        class="grid grid-cols-1 gap-3 border-t border-[color:var(--ot-border)] p-3 xl:grid-cols-2"
      >
        <div class="preview-table-card xl:col-span-2">
          <div class="preview-table-title">Payment Detail Preview</div>

          <DataTable
            :value="previewData.detailRows || []"
            scrollable
            scrollHeight="320px"
            size="small"
            tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
            class="payment-preview-table"
          >
            <template #empty>
              <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                No payable payment detail found.
              </div>
            </template>

            <Column field="otDate" header="Date" />
            <Column field="requestNo" header="Request No" />
            <Column field="shiftOtOptionLabel" header="OT Option" />
            <Column field="requestTime" header="OT Time" />

            <Column header="Payment Day Type">
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.dayType)"
                  :severity="dayTypeSeverity(data.dayType)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column header="Internal Calendar">
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.internalCalendarDayType)"
                  :severity="dayTypeSeverity(data.internalCalendarDayType)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column header="Stored Type">
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.storedDayType)"
                  :severity="dayTypeSeverity(data.storedDayType)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column field="employeeNo" header="ID" />
            <Column field="employeeName" header="Name" />
            <Column field="monthlySalary" header="Salary" />

            <Column header="OT Option Time">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.requestedMinutes) }}
              </template>
            </Column>

            <Column header="Break Time">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.breakMinutes) }}
              </template>
            </Column>

            <Column header="Total Request Paid">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.totalRequestPaidMinutes) }}
              </template>
            </Column>

            <Column header="Actual">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.actualOtMinutes) }}
              </template>
            </Column>

            <Column header="Eligible">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.eligibleOtMinutes) }}
              </template>
            </Column>

            <Column header="Payable">
              <template #body="{ data }">
                {{ formatMinutesLabel(data.roundedOtMinutes) }}
              </template>
            </Column>

            <Column header="Backend Cap">
              <template #body="{ data }">
                <Tag
                  :value="data.cappedByRequestPaidMinutes ? 'Capped by request paid' : 'Backend calculated'"
                  :severity="data.cappedByRequestPaidMinutes ? 'warning' : 'success'"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column field="payableHours" header="Hours" />
            <Column field="multiplier" header="Multiplier" />
            <Column field="amount" header="Amount" />
            <Column field="currency" header="Currency" />

            <Column header="Decision">
              <template #body="{ data }">
                <Tag
                  :value="data.rawOtDecision || data.otResult || '-'"
                  :severity="decisionSeverity(data.rawOtDecision || data.otResult)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column field="otResultReason" header="Reason" />
          </DataTable>
        </div>

        <div class="preview-table-card">
          <div class="preview-table-title">Missing Salary</div>

          <DataTable
            :value="previewData.missingSalaryRows || []"
            scrollable
            scrollHeight="220px"
            size="small"
            tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
            class="payment-preview-table"
          >
            <template #empty>
              <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                No missing salary.
              </div>
            </template>

            <Column field="otDate" header="Date" />
            <Column field="requestNo" header="Request No" />
            <Column field="employeeNo" header="ID" />
            <Column field="employeeName" header="Name" />
            <Column field="payableHours" header="OT Hours" />
            <Column field="reason" header="Reason" />
          </DataTable>
        </div>

        <div class="preview-table-card">
          <div class="preview-table-title">Warnings</div>

          <DataTable
            :value="previewData.warningRows || []"
            scrollable
            scrollHeight="220px"
            size="small"
            tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
            class="payment-preview-table"
          >
            <template #empty>
              <div class="py-6 text-center text-sm text-[color:var(--ot-text-muted)]">
                No warnings.
              </div>
            </template>

            <Column field="otDate" header="Date" />
            <Column field="requestNo" header="Request No" />
            <Column field="employeeNo" header="ID" />
            <Column field="employeeName" header="Name" />
            <Column field="reason" header="Reason" />
          </DataTable>
        </div>
      </div>

      <div
        v-else
        class="border-t border-[color:var(--ot-border)] px-3 py-8 text-center text-sm text-[color:var(--ot-text-muted)]"
      >
        Upload salary Excel and click Preview to see the payment result before download.
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-card {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.04), transparent),
    var(--ot-bg);
  padding: 0.85rem;
}

.payment-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.payment-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ot-text);
}

.payment-subtitle,
.payment-section-subtitle {
  margin-top: 0.12rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.payment-section-title {
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--ot-text);
}

.payment-info-box {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.65rem 0.75rem;
}

.payment-info-label {
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  color: var(--ot-text-muted);
}

.payment-info-value {
  margin-top: 0.35rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ot-text);
}

.payment-formula-box {
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--ot-surface) 76%, transparent);
  padding: 0.7rem 0.75rem;
}

.payment-empty-box {
  margin-top: 0.75rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ot-text-muted);
}

.summary-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface);
  padding: 0.75rem;
}

.summary-icon {
  display: flex;
  height: 2rem;
  width: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 0.75rem;
  font-size: 0.85rem;
}

.summary-label {
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--ot-text-muted);
}

.summary-value {
  margin-top: 0.15rem;
  font-size: 0.9rem;
  font-weight: 800;
  color: var(--ot-text);
}

.card-blue .summary-icon {
  background: rgba(59, 130, 246, 0.13);
  color: #2563eb;
}

.card-green .summary-icon {
  background: rgba(34, 197, 94, 0.13);
  color: #16a34a;
}

.card-purple .summary-icon {
  background: rgba(168, 85, 247, 0.13);
  color: #9333ea;
}

.card-orange .summary-icon {
  background: rgba(249, 115, 22, 0.13);
  color: #ea580c;
}

.card-red .summary-icon {
  background: rgba(239, 68, 68, 0.13);
  color: #dc2626;
}

.preview-table-card {
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-bg);
}

.preview-table-title {
  border-bottom: 1px solid var(--ot-border);
  padding: 0.65rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--ot-text);
}

:deep(.payment-preview-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-preview-table .p-datatable-thead > tr > th) {
  padding: 0.55rem 0.65rem !important;
  white-space: nowrap !important;
  font-size: 0.72rem !important;
}

:deep(.payment-preview-table .p-datatable-tbody > tr > td) {
  padding: 0.5rem 0.65rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  font-size: 0.76rem !important;
}

:deep(.p-tag.payment-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
  white-space: nowrap !important;
}

:deep(.p-tag.payment-day-working) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.payment-day-sunday) {
  background: #ffedd5 !important;
  color: #9a3412 !important;
  border-color: #f97316 !important;
}

:deep(.p-tag.payment-day-holiday) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:global(.dark) .card-blue .summary-icon {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
}

:global(.dark) .card-green .summary-icon {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
}

:global(.dark) .card-purple .summary-icon {
  background: rgba(168, 85, 247, 0.18);
  color: #d8b4fe;
}

:global(.dark) .card-orange .summary-icon {
  background: rgba(249, 115, 22, 0.18);
  color: #fdba74;
}

:global(.dark) .card-red .summary-icon {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

:global(.dark) :deep(.p-tag.payment-day-working) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.payment-day-sunday) {
  background: rgba(249, 115, 22, 0.18) !important;
  color: #fdba74 !important;
  border-color: rgba(249, 115, 22, 0.45) !important;
}

:global(.dark) :deep(.p-tag.payment-day-holiday) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

@media (max-width: 768px) {
  .payment-card {
    padding: 0.75rem;
  }

  .payment-card-header {
    flex-direction: column;
  }
}
</style>