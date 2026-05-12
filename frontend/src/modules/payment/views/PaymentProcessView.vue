<!-- frontend/src/modules/payment/views/PaymentProcessView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import { getHolidays } from '@/modules/calendar/holiday.api'
import {
  calculatePaymentExport,
  downloadSalaryTemplate,
  getPaymentFormulaLookupOptions,
  previewPayment,
} from '@/modules/payment/payment.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

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
  fromDate: '',
  toDate: '',
  formulaId: '',
})

let calendarTimer = null

const selectedFormula = computed(() => {
  const id = s(form.formulaId)
  return formulaOptions.value.find((item) => s(item.id || item._id || item.value) === id) || null
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

const periodStartYMD = computed(() => normalizeYMD(form.fromDate))
const periodEndYMD = computed(() => normalizeYMD(form.toDate))

const holidayDateSet = computed(() => {
  return new Set(
    periodHolidayRows.value
      .map((item) => s(item?.date))
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
    const ymd = normalizeYMD(cursor)
    const holiday = periodHolidayRows.value.find((item) => item.date === ymd) || null

    rows.push({
      date: ymd,
      dayType: getDisplayDayType(ymd),
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
      label: t('payment.process.summary.payableEmployees'),
      value: summary ? summary.employeeCount : '—',
      icon: 'pi pi-users',
      className: 'card-blue',
    },
    {
      label: t('payment.process.summary.totalOtHours'),
      value: summary ? formatNumber(summary.totalPayableHours, 4) : '—',
      icon: 'pi pi-clock',
      className: 'card-green',
    },
    {
      label: t('payment.process.summary.totalAmount'),
      value: summary
        ? `${formatNumber(summary.totalAmount, 2)} ${summary.currency || ''}`
        : '—',
      icon: 'pi pi-wallet',
      className: 'card-purple',
    },
    {
      label: t('payment.process.summary.missingSalary'),
      value: summary ? summary.missingSalaryCount : '—',
      icon: 'pi pi-exclamation-triangle',
      className: 'card-orange',
    },
    {
      label: t('payment.process.summary.warnings'),
      value: summary ? summary.warningCount : '—',
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

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeFormulaOption(item) {
  const id = s(item.id || item._id || item.value)

  return {
    ...item,
    id,
    label: item.label || item.name || item.code || id,
  }
}

function normalizeYMD(value) {
  if (!value) return ''

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
  }

  const raw = s(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = new Date(raw)
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
  return formatDate(value) || '—'
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

function showToast(severity, summary, detail, life = 3000) {
  toast.add({
    severity,
    summary,
    detail,
    life,
  })
}

function resetPreview() {
  previewDone.value = false
  previewResult.value = null
}

function buildProcessPayload() {
  return {
    fromDate: periodStartYMD.value,
    toDate: periodEndYMD.value,
    formulaId: form.formulaId,
    salaryFile: salaryFile.value,
  }
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

function getDisplayDayType(ymd) {
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

  const labels = {
    HOLIDAY: t('payment.dayTypes.holiday'),
    SUNDAY: t('payment.dayTypes.sunday'),
    WORKING_DAY: t('payment.dayTypes.workingDay'),
  }

  return labels[normalized] || normalized || '—'
}

function decisionSeverity(value) {
  const normalized = upper(value)

  if (
    [
      'MATCH',
      'APPROVED_WITHOUT_EXACT_CLOCK_OUT',
      'FIXED_OT_APPROVED_WITHOUT_EXACT_CLOCK_OUT',
    ].includes(normalized)
  ) {
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
    formulaOptions.value = normalizeItems(payload).map(normalizeFormulaOption)
  } catch (error) {
    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('payment.process.message.loadFormulasFailed')),
    )
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

    rows.forEach((item) => {
      const date = s(item?.date)

      if (!date || date < from || date > to) return

      uniqueMap.set(date, {
        ...item,
        date,
      })
    })

    periodHolidayRows.value = [...uniqueMap.values()].sort((a, b) => {
      return s(a.date).localeCompare(s(b.date))
    })
  } catch (error) {
    periodHolidayRows.value = []

    showToast(
      'error',
      t('payment.process.message.calendarFailedTitle'),
      getApiErrorMessage(error, t('payment.process.message.calendarFailed')),
      3500,
    )
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

  const lowerName = String(file.name || '').toLowerCase()
  const isExcel = ['.xlsx', '.xls'].some((ext) => lowerName.endsWith(ext))

  if (!isExcel) {
    salaryFile.value = null

    if (salaryFileInput.value) {
      salaryFileInput.value.value = ''
    }

    showToast(
      'warn',
      t('payment.process.message.invalidFileTitle'),
      t('payment.process.message.invalidFile'),
    )

    return
  }

  salaryFile.value = file
}

function clearFile() {
  salaryFile.value = null

  if (salaryFileInput.value) {
    salaryFileInput.value.value = ''
  }

  resetPreview()
}

function clearForm() {
  form.fromDate = ''
  form.toDate = ''
  form.formulaId = ''
  periodHolidayRows.value = []
  clearFile()
  resetPreview()
}

async function handleDownloadTemplate() {
  downloadingTemplate.value = true

  try {
    const res = await downloadSalaryTemplate()
    downloadBlob(res, 'salary_template.xlsx')

    showToast(
      'success',
      t('payment.process.message.downloadedTitle'),
      t('payment.process.message.templateDownloaded'),
      2500,
    )
  } catch (error) {
    showToast(
      'error',
      t('payment.process.message.downloadFailedTitle'),
      getApiErrorMessage(error, t('payment.process.message.templateDownloadFailed')),
      3500,
    )
  } finally {
    downloadingTemplate.value = false
  }
}

function validateBeforeProcess() {
  if (!form.fromDate) return t('payment.process.validation.fromDateRequired')
  if (!form.toDate) return t('payment.process.validation.toDateRequired')
  if (!form.formulaId) return t('payment.process.validation.formulaRequired')
  if (!salaryFile.value) return t('payment.process.validation.salaryRequired')

  if (periodStartYMD.value > periodEndYMD.value) {
    return t('payment.process.validation.invalidDateRange')
  }

  return ''
}

async function handlePreview() {
  const validationMessage = validateBeforeProcess()

  if (validationMessage) {
    showToast(
      'warn',
      t('payment.process.message.checkFormTitle'),
      validationMessage,
    )
    return
  }

  previewing.value = true
  resetPreview()

  try {
    const res = await previewPayment(buildProcessPayload())
    const payload = normalizePayload(res)

    previewResult.value = payload
    previewDone.value = true

    showToast(
      'success',
      t('payment.process.message.previewReadyTitle'),
      t('payment.process.message.previewReady'),
      2500,
    )
  } catch (error) {
    showToast(
      'error',
      t('payment.process.message.previewFailedTitle'),
      getApiErrorMessage(error, t('payment.process.message.previewFailed')),
      4000,
    )
  } finally {
    previewing.value = false
  }
}

async function handleGenerate() {
  const validationMessage = validateBeforeProcess()

  if (validationMessage) {
    showToast(
      'warn',
      t('payment.process.message.checkFormTitle'),
      validationMessage,
    )
    return
  }

  if (!previewDone.value) {
    showToast(
      'warn',
      t('payment.process.message.previewRequiredTitle'),
      t('payment.process.message.previewRequired'),
    )
    return
  }

  generating.value = true

  try {
    const res = await calculatePaymentExport(buildProcessPayload())
    downloadBlob(res, `payment_${periodStartYMD.value}_to_${periodEndYMD.value}.xlsx`)

    showToast(
      'success',
      t('payment.process.message.generatedTitle'),
      t('payment.process.message.generated'),
    )
  } catch (error) {
    showToast(
      'error',
      t('payment.process.message.generateFailedTitle'),
      getApiErrorMessage(error, t('payment.process.message.generateFailed')),
      4000,
    )
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
  <div class="ot-page-shell">
    <section class="ot-filter-bar payment-process-filter-bar">
      <div class="ot-field">
        <HolidayDatePicker
          v-model="form.fromDate"
          :label="t('common.fromDate')"
          :placeholder="t('common.fromDate')"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="form.toDate"
          :label="t('common.toDate')"
          :placeholder="t('common.toDate')"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('payment.process.field.paymentFormula') }}
        </label>

        <Select
          v-model="form.formulaId"
          :options="formulaOptions"
          option-label="label"
          option-value="id"
          :loading="loadingFormulas"
          :placeholder="t('payment.process.field.paymentFormula')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('payment.process.field.salaryExcel') }}
        </label>

        <input
          ref="salaryFileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="onFileChange"
        >

        <Button
          :label="fileName ? t('payment.process.action.changeFile') : t('payment.process.action.uploadSalary')"
          icon="pi pi-upload"
          severity="secondary"
          outlined
          size="small"
          class="w-full justify-center"
          @click="chooseFile"
        />
      </div>

      <div class="ot-filter-actions payment-process-filter-actions">
        <Button
          :label="t('payment.process.action.template')"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :loading="downloadingTemplate"
          @click="handleDownloadTemplate"
        />

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          :disabled="previewing || generating"
          @click="clearForm"
        />

        <Button
          :label="t('payment.process.action.preview')"
          icon="pi pi-eye"
          severity="info"
          size="small"
          :loading="previewing"
          :disabled="!canPreview || generating"
          @click="handlePreview"
        />

        <Button
          :label="t('payment.process.action.generate')"
          icon="pi pi-file-excel"
          size="small"
          :loading="generating"
          :disabled="!canGenerate || previewing"
          @click="handleGenerate"
        />
      </div>
    </section>

    <section class="grid gap-4 xl:grid-cols-2">
      <div class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('payment.process.card.processingTitle') }}
            </h2>

            <p class="payment-muted-text">
              {{ t('payment.process.card.processingSubtitle') }}
            </p>
          </div>

          <div class="ot-table-actions">
            <Tag
              :value="previewDone ? t('payment.process.status.previewReady') : t('payment.process.status.notPreviewed')"
              :severity="previewDone ? 'success' : 'warning'"
              class="payment-tag"
            />
          </div>
        </div>

        <div class="grid gap-3 p-3 md:grid-cols-2">
          <div class="ot-panel">
            <div class="ot-field-label">
              {{ t('common.fromDate') }}
            </div>

            <div class="payment-info-value">
              {{ formatDateDMY(form.fromDate) }}
            </div>
          </div>

          <div class="ot-panel">
            <div class="ot-field-label">
              {{ t('common.toDate') }}
            </div>

            <div class="payment-info-value">
              {{ formatDateDMY(form.toDate) }}
            </div>
          </div>

          <div class="ot-panel md:col-span-2">
            <div class="ot-field-label">
              {{ t('payment.process.field.salaryExcel') }}
            </div>

            <div class="flex min-w-0 items-center justify-between gap-2">
              <div class="payment-info-value truncate">
                {{ fileName || t('payment.process.field.noFile') }}
              </div>

              <Button
                v-if="salaryFile"
                icon="pi pi-times"
                text
                rounded
                severity="danger"
                size="small"
                :aria-label="t('common.clear')"
                @click="clearFile"
              />
            </div>
          </div>
        </div>

        <div class="border-t border-[color:var(--ot-border)] p-3">
          <Message
            severity="warn"
            :closable="false"
            class="m-0"
          >
            {{ t('payment.process.note.notSaved') }}
          </Message>
        </div>
      </div>

      <div class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('payment.process.card.formulaTitle') }}
            </h2>

            <p class="payment-muted-text">
              {{ t('payment.process.card.formulaSubtitle') }}
            </p>
          </div>

          <div class="ot-table-actions">
            <Tag
              :value="selectedFormula ? t('payment.process.status.ready') : t('payment.process.status.selectFormula')"
              :severity="selectedFormula ? 'success' : 'secondary'"
              class="payment-tag"
            />
          </div>
        </div>

        <div
          v-if="selectedFormula"
          class="grid gap-3 p-3"
        >
          <div class="ot-panel">
            <div class="ot-field-label">
              {{ t('payment.process.field.formula') }}
            </div>

            <div class="payment-info-value">
              {{ selectedFormula.label || selectedFormula.name || '—' }}
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="ot-panel">
              <div class="ot-field-label">
                {{ t('payment.process.field.workingDays') }}
              </div>

              <div class="payment-info-value">
                {{ selectedFormula.monthlyWorkingDays || '—' }}
                /
                {{ t('payment.process.field.month') }}
              </div>
            </div>

            <div class="ot-panel">
              <div class="ot-field-label">
                {{ t('payment.process.field.hoursPerDay') }}
              </div>

              <div class="payment-info-value">
                {{ selectedFormula.hoursPerDay || '—' }}
                {{ t('payment.process.field.hours') }}
              </div>
            </div>
          </div>

          <div class="ot-panel">
            <div class="ot-field-label">
              {{ t('payment.process.field.multipliers') }}
            </div>

            <div class="mt-2 flex flex-wrap gap-1.5">
              <Tag
                :value="`${t('payment.dayTypes.workingDay')} ${formatNumber(selectedFormula.multipliers?.WORKING_DAY)}x`"
                severity="success"
                class="payment-tag payment-day-working"
              />

              <Tag
                :value="`${t('payment.dayTypes.sunday')} ${formatNumber(selectedFormula.multipliers?.SUNDAY)}x`"
                severity="warning"
                class="payment-tag payment-day-sunday"
              />

              <Tag
                :value="`${t('payment.dayTypes.holiday')} ${formatNumber(selectedFormula.multipliers?.HOLIDAY)}x`"
                severity="danger"
                class="payment-tag payment-day-holiday"
              />
            </div>
          </div>

          <div class="ot-panel">
            <div class="ot-field-label">
              {{ t('payment.process.field.calculation') }}
            </div>

            <div class="payment-formula-preview">
              <div>
                {{ t('payment.formulas.hourlyRatePreview') }}
              </div>

              <div>
                {{ t('payment.formulas.otAmountPreview') }}
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="ot-empty-state"
        >
          <div class="ot-empty-icon">
            <i class="pi pi-calculator" />
          </div>

          <div class="ot-empty-title">
            {{ t('payment.process.empty.noFormula') }}
          </div>

          <div class="ot-empty-text">
            {{ t('payment.process.empty.selectFormula') }}
          </div>
        </div>
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('payment.process.calendar.title') }}
          </h2>

          <p class="payment-muted-text">
            {{ t('payment.process.calendar.subtitle') }}
          </p>
        </div>

        <div class="ot-table-actions">
          <Tag
            :value="loadingCalendar ? t('payment.process.calendar.loading') : t('payment.process.calendar.holidayCount', { count: periodHolidayRows.length })"
            :severity="loadingCalendar ? 'info' : 'secondary'"
            class="payment-tag"
          />
        </div>
      </div>

      <div class="grid gap-3 p-3 md:grid-cols-3">
        <div class="payment-summary-card card-green">
          <div class="summary-icon">
            <i class="pi pi-briefcase" />
          </div>

          <div>
            <div class="summary-label">
              {{ t('payment.process.calendar.workingDays') }}
            </div>

            <div class="summary-value">
              {{ periodCalendarSummary.workingDays }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-orange">
          <div class="summary-icon">
            <i class="pi pi-sun" />
          </div>

          <div>
            <div class="summary-label">
              {{ t('payment.process.calendar.sundays') }}
            </div>

            <div class="summary-value">
              {{ periodCalendarSummary.sundays }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-red">
          <div class="summary-icon">
            <i class="pi pi-star" />
          </div>

          <div>
            <div class="summary-label">
              {{ t('payment.process.calendar.internalHolidays') }}
            </div>

            <div class="summary-value">
              {{ periodCalendarSummary.holidays }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="periodHolidayRows.length"
        class="flex flex-wrap gap-2 border-t border-[color:var(--ot-border)] p-3"
      >
        <Tag
          v-for="holiday in periodHolidayRows"
          :key="holiday.id || holiday._id || holiday.date"
          :value="`${formatDateDMY(holiday.date)} · ${holiday.name || holiday.code || t('payment.dayTypes.holiday')}`"
          severity="danger"
          class="payment-tag"
        />
      </div>
    </section>

    <section
      v-if="previewResult"
      class="ot-table-card"
    >
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('payment.process.preview.title') }}
          </h2>

          <p class="payment-muted-text">
            {{ t('payment.process.preview.subtitle') }}
          </p>
        </div>

        <div class="ot-table-actions">
          <span class="ot-loaded-badge">
            {{ t('payment.process.preview.notSaved') }}
          </span>
        </div>
      </div>

      <div class="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-5">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="payment-summary-card"
          :class="card.className"
        >
          <div class="summary-icon">
            <i :class="card.icon" />
          </div>

          <div class="min-w-0">
            <div class="summary-label">
              {{ card.label }}
            </div>

            <div class="summary-value truncate">
              {{ card.value }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="previewResult"
      class="grid gap-4 xl:grid-cols-2"
    >
      <div class="ot-table-card xl:col-span-2">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('payment.process.table.detail') }}
            </h2>
          </div>
        </div>

        <div class="ot-table-wrapper">
          <DataTable
            :value="previewData.detailRows || []"
            scrollable
            scroll-height="420px"
            table-style="width: max-content; min-width: 100%; table-layout: auto;"
            class="ot-data-table ot-data-table-compact payment-preview-table"
          >
            <template #empty>
              <div class="ot-empty-state">
                <div class="ot-empty-icon">
                  <i class="pi pi-wallet" />
                </div>

                <div class="ot-empty-title">
                  {{ t('common.noData') }}
                </div>

                <div class="ot-empty-text">
                  {{ t('payment.process.empty.noPaymentDetail') }}
                </div>
              </div>
            </template>

            <Column
              field="otDate"
              :header="t('common.date')"
              style="min-width: 8rem"
            />

            <Column
              field="requestNo"
              :header="t('payment.process.column.requestNo')"
              style="min-width: 10rem"
            />

            <Column
              field="shiftOtOptionLabel"
              :header="t('payment.process.column.otOption')"
              style="min-width: 14rem"
            />

            <Column
              field="requestTime"
              :header="t('payment.process.column.otTime')"
              style="min-width: 10rem"
            />

            <Column
              :header="t('payment.process.column.paymentDayType')"
              style="min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.dayType)"
                  :severity="dayTypeSeverity(data.dayType)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.internalCalendar')"
              style="min-width: 12rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.internalCalendarDayType)"
                  :severity="dayTypeSeverity(data.internalCalendarDayType)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.storedType')"
              style="min-width: 10rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.storedDayType)"
                  :severity="dayTypeSeverity(data.storedDayType)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column
              field="employeeNo"
              :header="t('payment.process.column.employeeId')"
              style="min-width: 8rem"
            />

            <Column
              field="employeeName"
              :header="t('payment.process.column.employeeName')"
              style="min-width: 14rem"
            />

            <Column
              field="monthlySalary"
              :header="t('payment.process.column.salary')"
              style="min-width: 8rem"
            />

            <Column
              :header="t('payment.process.column.otOptionTime')"
              style="min-width: 10rem"
            >
              <template #body="{ data }">
                {{ formatMinutesLabel(data.requestedMinutes) }}
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.breakTime')"
              style="min-width: 9rem"
            >
              <template #body="{ data }">
                {{ formatMinutesLabel(data.breakMinutes) }}
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.totalRequestPaid')"
              style="min-width: 12rem"
            >
              <template #body="{ data }">
                {{ formatMinutesLabel(data.totalRequestPaidMinutes) }}
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.actual')"
              style="min-width: 8rem"
            >
              <template #body="{ data }">
                {{ formatMinutesLabel(data.actualOtMinutes) }}
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.eligible')"
              style="min-width: 8rem"
            >
              <template #body="{ data }">
                {{ formatMinutesLabel(data.eligibleOtMinutes) }}
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.payable')"
              style="min-width: 8rem"
            >
              <template #body="{ data }">
                {{ formatMinutesLabel(data.roundedOtMinutes) }}
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.backendCap')"
              style="min-width: 13rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="data.cappedByRequestPaidMinutes ? t('payment.process.label.cappedByRequestPaid') : t('payment.process.label.backendCalculated')"
                  :severity="data.cappedByRequestPaidMinutes ? 'warning' : 'success'"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column
              field="payableHours"
              :header="t('payment.process.column.hours')"
              style="min-width: 7rem"
            />

            <Column
              field="multiplier"
              :header="t('payment.process.column.multiplier')"
              style="min-width: 8rem"
            />

            <Column
              field="amount"
              :header="t('payment.process.column.amount')"
              style="min-width: 8rem"
            />

            <Column
              field="currency"
              :header="t('payment.process.column.currency')"
              style="min-width: 8rem"
            />

            <Column
              :header="t('payment.process.column.decision')"
              style="min-width: 12rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="data.rawOtDecision || data.otResult || '—'"
                  :severity="decisionSeverity(data.rawOtDecision || data.otResult)"
                  class="payment-tag"
                />
              </template>
            </Column>

            <Column
              field="otResultReason"
              :header="t('payment.process.column.reason')"
              style="min-width: 18rem"
            />
          </DataTable>
        </div>
      </div>

      <div class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('payment.process.table.missingSalary') }}
            </h2>
          </div>
        </div>

        <div class="ot-table-wrapper">
          <DataTable
            :value="previewData.missingSalaryRows || []"
            scrollable
            scroll-height="260px"
            table-style="width: max-content; min-width: 100%; table-layout: auto;"
            class="ot-data-table ot-data-table-compact payment-preview-table"
          >
            <template #empty>
              <div class="ot-empty-state">
                <div class="ot-empty-icon">
                  <i class="pi pi-check-circle" />
                </div>

                <div class="ot-empty-title">
                  {{ t('payment.process.empty.noMissingSalary') }}
                </div>
              </div>
            </template>

            <Column
              field="otDate"
              :header="t('common.date')"
              style="min-width: 8rem"
            />

            <Column
              field="requestNo"
              :header="t('payment.process.column.requestNo')"
              style="min-width: 10rem"
            />

            <Column
              field="employeeNo"
              :header="t('payment.process.column.employeeId')"
              style="min-width: 8rem"
            />

            <Column
              field="employeeName"
              :header="t('payment.process.column.employeeName')"
              style="min-width: 14rem"
            />

            <Column
              field="payableHours"
              :header="t('payment.process.column.otHours')"
              style="min-width: 8rem"
            />

            <Column
              field="reason"
              :header="t('payment.process.column.reason')"
              style="min-width: 18rem"
            />
          </DataTable>
        </div>
      </div>

      <div class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('payment.process.table.warnings') }}
            </h2>
          </div>
        </div>

        <div class="ot-table-wrapper">
          <DataTable
            :value="previewData.warningRows || []"
            scrollable
            scroll-height="260px"
            table-style="width: max-content; min-width: 100%; table-layout: auto;"
            class="ot-data-table ot-data-table-compact payment-preview-table"
          >
            <template #empty>
              <div class="ot-empty-state">
                <div class="ot-empty-icon">
                  <i class="pi pi-check-circle" />
                </div>

                <div class="ot-empty-title">
                  {{ t('payment.process.empty.noWarnings') }}
                </div>
              </div>
            </template>

            <Column
              field="otDate"
              :header="t('common.date')"
              style="min-width: 8rem"
            />

            <Column
              field="requestNo"
              :header="t('payment.process.column.requestNo')"
              style="min-width: 10rem"
            />

            <Column
              field="employeeNo"
              :header="t('payment.process.column.employeeId')"
              style="min-width: 8rem"
            />

            <Column
              field="employeeName"
              :header="t('payment.process.column.employeeName')"
              style="min-width: 14rem"
            />

            <Column
              field="reason"
              :header="t('payment.process.column.reason')"
              style="min-width: 18rem"
            />
          </DataTable>
        </div>
      </div>
    </section>

    <section
      v-else
      class="ot-table-card"
    >
      <div class="ot-empty-state">
        <div class="ot-empty-icon">
          <i class="pi pi-file-excel" />
        </div>

        <div class="ot-empty-title">
          {{ t('payment.process.empty.previewTitle') }}
        </div>

        <div class="ot-empty-text">
          {{ t('payment.process.empty.previewHint') }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
@media (min-width: 1280px) {
  .payment-process-filter-bar {
    grid-template-columns:
      minmax(180px, 220px)
      minmax(180px, 220px)
      minmax(220px, 280px)
      minmax(160px, 190px)
      auto;
    align-items: end;
  }

  .payment-process-filter-actions {
    flex-wrap: nowrap;
    justify-content: flex-end;
    min-width: max-content;
  }
}

.payment-muted-text {
  margin-top: 0.12rem;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--ot-text-muted);
}

.payment-info-value {
  margin-top: 0.35rem;
  font-size: 0.84rem;
  color: var(--ot-text);
}

.payment-formula-preview {
  margin-top: 0.45rem;
  display: grid;
  gap: 0.35rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.68rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--ot-text);
}

.payment-summary-card {
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
  color: var(--ot-text-muted);
}

.summary-value {
  margin-top: 0.15rem;
  font-size: 0.9rem;
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

:deep(.payment-preview-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-preview-table .p-datatable-thead > tr > th) {
  white-space: nowrap !important;
}

:deep(.payment-preview-table .p-datatable-tbody > tr > td) {
  vertical-align: middle !important;
  white-space: nowrap !important;
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
</style>