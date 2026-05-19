<!-- frontend/src/modules/payment/views/PaymentProcessView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentProcessView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import { getHolidays } from '@/modules/calendar/holiday.api'
import {
  calculatePaymentExport,
  downloadSalaryTemplate,
  getPaymentExchangeRateLookupOptions,
  getPaymentFormulaLookupOptions,
  previewPayment,
} from '@/modules/payment/payment.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/utils/dateFormat'

const toast = useToast()
const { t } = useI18n()

const DETAIL_PAGE_SIZE = 10
const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

const formulaOptions = ref([])
const exchangeRateOptions = ref([])

const loadingFormulas = ref(false)
const loadingExchangeRates = ref(false)

const downloadingTemplate = ref(false)
const previewing = ref(false)
const generating = ref(false)

const loadingCalendar = ref(false)
const periodHolidayRows = ref([])

const salaryFile = ref(null)
const salaryFileInput = ref(null)

const previewDone = ref(false)
const previewResult = ref(null)
const detailLoadedCount = ref(DETAIL_PAGE_SIZE)

const form = reactive({
  fromDate: '',
  toDate: '',
  formulaId: '',
  exchangeRateId: '',
})

let calendarTimer = null

const selectedFormula = computed(() => {
  const id = s(form.formulaId)

  return (
    formulaOptions.value.find((item) => s(item.id || item._id || item.value) === id) ||
    null
  )
})

const selectedExchangeRate = computed(() => {
  const id = s(form.exchangeRateId)

  return (
    exchangeRateOptions.value.find(
      (item) => s(item.id || item._id || item.value) === id,
    ) || null
  )
})

const canPreview = computed(() => {
  return Boolean(
    form.fromDate &&
      form.toDate &&
      form.formulaId &&
      form.exchangeRateId &&
      salaryFile.value,
  )
})

const canGenerate = computed(() => {
  return canPreview.value && previewDone.value && previewResult.value
})

const fileName = computed(() => salaryFile.value?.name || '')

const previewSummary = computed(() => previewResult.value?.summary || null)

const paymentDetailRows = computed(() => {
  const items = previewResult.value?.items || []
  return Array.isArray(items) ? items : []
})

const visiblePaymentDetailRows = computed(() => {
  return paymentDetailRows.value.slice(0, detailLoadedCount.value)
})

const hasMorePaymentDetailRows = computed(() => {
  return visiblePaymentDetailRows.value.length < paymentDetailRows.value.length
})

const paymentDetailLoadedLabel = computed(() =>
  t('common.loaded', {
    loaded: visiblePaymentDetailRows.value.length,
    total: paymentDetailRows.value.length,
  }),
)

const missingSalaryRows = computed(() => {
  const rows = previewResult.value?.issues?.missingSalaryEmployees || []
  return Array.isArray(rows) ? rows : []
})

const warningRows = computed(() => {
  const invalidRows = previewResult.value?.issues?.invalidSalaryRows || []
  const duplicateRows = previewResult.value?.issues?.duplicateSalaryRows || []
  const missingPayableRows = previewResult.value?.issues?.missingPayableEmployees || []

  return [
    ...asArray(invalidRows).map((row) => ({
      type: t('payment.process.warning.invalidSalaryRow'),
      rowNo: row.rowNo || row.excelRowNo || '',
      employeeNo: row.employeeNo || '',
      employeeName: row.name || row.employeeName || '',
      reason: row.reason || t('payment.process.warning.invalidSalaryRow'),
    })),

    ...asArray(duplicateRows).map((row) => ({
      type: t('payment.process.warning.duplicateSalaryRow'),
      rowNo: row.rowNo || row.excelRowNo || '',
      employeeNo: row.employeeNo || '',
      employeeName: row.name || row.employeeName || '',
      reason: row.reason || t('payment.process.warning.duplicateSalaryRow'),
    })),

    ...asArray(missingPayableRows).map((row) => ({
      type: t('payment.process.warning.noPayableMinutes'),
      rowNo: '',
      employeeNo: row.employeeNo || '',
      employeeName: row.employeeName || '',
      reason: row.reason || t('payment.process.warning.noPayableMinutes'),
    })),
  ]
})

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

const denominationColumns = computed(() => {
  const source =
    previewResult.value?.exchangeRate?.denominations ||
    selectedExchangeRate.value?.denominations ||
    DEFAULT_DENOMINATIONS

  return normalizeDenominations(source)
})

const summaryCards = computed(() => {
  const summary = previewSummary.value
  const formula = previewResult.value?.formula || selectedFormula.value || {}

  return [
    {
      label: t('payment.process.summary.payableEmployees'),
      value: summary ? Number(summary.summaryByEmployee?.length || 0) : '—',
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
      label: t('payment.process.summary.totalUsd'),
      value: summary
        ? formatMoney(summary.totalAmountUsd ?? summary.totalAmount, formula.currency || 'USD')
        : '—',
      icon: 'pi pi-wallet',
      className: 'card-purple',
    },
    {
      label: t('payment.process.summary.totalKhr'),
      value: summary ? `${formatNumber(summary.totalAmountKhrRounded, 0)} KHR` : '—',
      icon: 'pi pi-money-bill',
      className: 'card-green',
    },
    {
      label: t('payment.process.summary.missingSalary'),
      value: summary ? Number(summary.missingSalaryItemCount || 0) : '—',
      icon: 'pi pi-exclamation-triangle',
      className: 'card-orange',
    },
    {
      label: t('payment.process.summary.warnings'),
      value: warningRows.value.length,
      icon: 'pi pi-info-circle',
      className: 'card-red',
    },
  ]
})

watch(
  () => [periodStartYMD.value, periodEndYMD.value],
  () => {
    resetPreview()
    scheduleCalendarLoad()
  },
)

watch(
  () => [form.formulaId, form.exchangeRateId],
  () => {
    resetPreview()
  },
)

watch(
  () => form.formulaId,
  async () => {
    form.exchangeRateId = ''
    await loadExchangeRateOptions()
  },
)

function asArray(value) {
  return Array.isArray(value) ? value : []
}

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
    currency: upper(item.currency || 'USD'),
  }
}

function normalizeExchangeRateOption(item) {
  const id = s(item.id || item._id || item.value)
  const fromCurrency = upper(item.fromCurrency || 'USD')
  const toCurrency = upper(item.toCurrency || 'KHR')
  const rate = Number(item.rate || 0)

  return {
    ...item,
    id,
    fromCurrency,
    toCurrency,
    rate,
    denominations: normalizeDenominations(item.denominations || DEFAULT_DENOMINATIONS),
    label:
      item.label ||
      `${item.code || item.name || id} · ${fromCurrency} 1 = ${formatNumber(rate, 6)} ${toCurrency}`,
  }
}

function normalizeDenominations(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_DENOMINATIONS

  return [
    ...new Set(
      source
        .map((item) => Math.round(Number(item || 0)))
        .filter((item) => item > 0),
    ),
  ].sort((a, b) => b - a)
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
  const number = Number(value)

  if (!Number.isFinite(number)) return decimals === 0 ? '0' : '0'

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(number)
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

function actualOtTimeMinutes(row = {}) {
  const direct = Number(
    row.actualOtMinutes ??
      row.actualMinutes ??
      row.verifiedActualOtMinutes ??
      row.attendanceActualOtMinutes,
  )

  if (Number.isFinite(direct) && direct > 0) {
    return direct
  }

  return Number(row.payableMinutes || 0)
}

function formatRequestTime(row) {
  const start = s(row?.requestStartTime || row?.startTime)
  const end = s(row?.requestEndTime || row?.endTime)

  if (start && end) return `${start} - ${end}`
  if (start) return start
  if (end) return end

  return '—'
}

function formatMoney(value, currency = '') {
  const amount = formatNumber(value, 2)
  return currency ? `${amount} ${currency}` : amount
}

function khrPaper(row, denomination) {
  return Number(row?.khrBreakdown?.[String(denomination)] || 0)
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
  detailLoadedCount.value = DETAIL_PAGE_SIZE
}

function buildProcessPayload() {
  return {
    fromDate: periodStartYMD.value,
    toDate: periodEndYMD.value,
    formulaId: form.formulaId,
    exchangeRateId: form.exchangeRateId,
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

function dayTypeLabel(value) {
  const normalized = upper(value)

  const labels = {
    HOLIDAY: t('payment.dayTypes.holiday'),
    SUNDAY: t('payment.dayTypes.sunday'),
    WORKING_DAY: t('payment.dayTypes.workingDay'),
  }

  return labels[normalized] || normalized || '—'
}

function dayTypeTagClass(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'payment-day-holiday'
  if (normalized === 'SUNDAY') return 'payment-day-sunday'
  if (normalized === 'WORKING_DAY') return 'payment-day-working'

  return 'payment-tag-muted'
}

function salaryStatusLabel(value) {
  return value ? t('common.yes') : t('common.no')
}

function salaryStatusTagClass(value) {
  return value ? 'payment-status-active' : 'payment-status-inactive'
}

function loadMorePaymentRows() {
  detailLoadedCount.value = Math.min(
    detailLoadedCount.value + DETAIL_PAGE_SIZE,
    paymentDetailRows.value.length,
  )
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

async function loadExchangeRateOptions() {
  if (!form.formulaId) {
    exchangeRateOptions.value = []
    return
  }

  loadingExchangeRates.value = true

  try {
    const res = await getPaymentExchangeRateLookupOptions({
      isActive: true,
      limit: 100,
    })

    const payload = normalizePayload(res)
    const formulaCurrency = upper(selectedFormula.value?.currency || 'USD')

    exchangeRateOptions.value = normalizeItems(payload)
      .map(normalizeExchangeRateOption)
      .filter((item) => {
        return item.fromCurrency === formulaCurrency && item.toCurrency === 'KHR'
      })
  } catch (error) {
    showToast(
      'error',
      t('common.loadFailed'),
      getApiErrorMessage(error, t('payment.process.message.loadExchangeRatesFailed')),
    )
  } finally {
    loadingExchangeRates.value = false
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
  form.exchangeRateId = ''
  exchangeRateOptions.value = []
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
  if (!form.exchangeRateId) return t('payment.process.validation.exchangeRateRequired')
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
    detailLoadedCount.value = DETAIL_PAGE_SIZE

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
  <div class="ot-page-shell payment-process-page">
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
          {{ t('payment.process.field.exchangeRate') }}
        </label>

        <Select
          v-model="form.exchangeRateId"
          :options="exchangeRateOptions"
          option-label="label"
          option-value="id"
          :loading="loadingExchangeRates"
          :disabled="!form.formulaId"
          :placeholder="
            form.formulaId
              ? t('payment.process.field.exchangeRate')
              : t('payment.process.empty.selectFormulaFirst')
          "
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
          class="w-full justify-center payment-action-button"
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
          class="payment-action-button"
          :loading="downloadingTemplate"
          @click="handleDownloadTemplate"
        />

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="payment-action-button"
          :disabled="previewing || generating"
          @click="clearForm"
        />

        <Button
          :label="t('payment.process.action.preview')"
          icon="pi pi-eye"
          severity="info"
          size="small"
          class="payment-action-button"
          :loading="previewing"
          :disabled="!canPreview || generating"
          @click="handlePreview"
        />

        <Button
          :label="t('payment.process.action.generate')"
          icon="pi pi-file-excel"
          size="small"
          class="payment-action-button"
          :loading="generating"
          :disabled="!canGenerate || previewing"
          @click="handleGenerate"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('payment.process.calendar.title') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <Tag
            :value="loadingCalendar ? t('payment.process.calendar.loading') : t('payment.process.calendar.holidayCount', { count: periodHolidayRows.length })"
            class="payment-rgb-tag"
            :class="loadingCalendar ? 'payment-tag-info' : 'payment-tag-muted'"
          />
        </div>
      </div>

      <div class="payment-summary-grid payment-calendar-grid">
        <div class="payment-summary-card card-blue">
          <div class="summary-icon">
            <i class="pi pi-calendar" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('common.fromDate') }}
            </div>

            <div class="summary-value">
              {{ periodStartYMD || '—' }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-blue">
          <div class="summary-icon">
            <i class="pi pi-calendar" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('common.toDate') }}
            </div>

            <div class="summary-value">
              {{ periodEndYMD || '—' }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-green">
          <div class="summary-icon">
            <i class="pi pi-briefcase" />
          </div>

          <div class="summary-content">
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

          <div class="summary-content">
            <div class="summary-label">
              {{ t('payment.dayTypes.sunday') }}
            </div>

            <div class="summary-value">
              {{ periodCalendarSummary.sundays }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-red">
          <div class="summary-icon">
            <i class="pi pi-flag" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('payment.dayTypes.holiday') }}
            </div>

            <div class="summary-value">
              {{ periodCalendarSummary.holidays }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('payment.process.table.setup') }}
          </h2>
        </div>
      </div>

      <div class="payment-summary-grid payment-setup-grid">
        <div class="payment-summary-card card-purple">
          <div class="summary-icon">
            <i class="pi pi-calculator" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('payment.process.field.paymentFormula') }}
            </div>

            <div
              class="summary-value"
              :title="selectedFormula?.label || t('payment.process.empty.noFormula')"
            >
              {{ selectedFormula?.label || t('payment.process.empty.noFormula') }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-green">
          <div class="summary-icon">
            <i class="pi pi-money-bill" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('payment.process.field.exchangeRate') }}
            </div>

            <div
              class="summary-value"
              :title="selectedExchangeRate?.label || t('payment.process.field.noExchangeRate')"
            >
              {{ selectedExchangeRate?.label || t('payment.process.field.noExchangeRate') }}
            </div>
          </div>
        </div>

        <div class="payment-summary-card card-orange">
          <div class="summary-icon">
            <i class="pi pi-file-excel" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ t('payment.process.field.salaryExcel') }}
            </div>

            <div
              class="summary-value"
              :title="fileName || t('payment.process.field.noFile')"
            >
              {{ fileName || t('payment.process.field.noFile') }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="previewResult"
      class="space-y-4"
    >
      <section class="payment-summary-grid payment-preview-summary-grid">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="payment-summary-card"
          :class="card.className"
        >
          <div class="summary-icon">
            <i :class="card.icon" />
          </div>

          <div class="summary-content">
            <div class="summary-label">
              {{ card.label }}
            </div>

            <div class="summary-value">
              {{ card.value }}
            </div>
          </div>
        </div>
      </section>

      <div class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              {{ t('payment.process.table.detail') }}
            </h2>
          </div>

          <div class="ot-table-actions">
            <span class="ot-loaded-badge">
              {{ paymentDetailLoadedLabel }}
            </span>
          </div>
        </div>

        <div class="ot-table-wrapper">
          <DataTable
            :value="visiblePaymentDetailRows"
            scrollable
            scroll-height="520px"
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
              :header="t('common.date')"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ data.otDateDisplay || formatDateDMY(data.otDate) }}
                </span>
              </template>
            </Column>

            <Column
              field="requestNo"
              :header="t('payment.process.column.requestNo')"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <span class="payment-code-text">
                  {{ data.requestNo || '—' }}
                </span>
              </template>
            </Column>

            <Column
              field="shiftOtOptionLabel"
              :header="t('payment.process.column.otOption')"
              style="width: 15rem; min-width: 15rem"
            >
              <template #body="{ data }">
                <span
                  class="payment-line-text"
                  :title="data.shiftOtOptionLabel || '—'"
                >
                  {{ data.shiftOtOptionLabel || '—' }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.otTime')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ formatRequestTime(data) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.paymentDayType')"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="dayTypeLabel(data.dayType)"
                  class="payment-rgb-tag"
                  :class="dayTypeTagClass(data.dayType)"
                />
              </template>
            </Column>

            <Column
              field="employeeNo"
              :header="t('payment.process.column.employeeId')"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-code-text">
                  {{ data.employeeNo || '—' }}
                </span>
              </template>
            </Column>

            <Column
              field="employeeName"
              :header="t('payment.process.column.employeeName')"
              style="width: 14rem; min-width: 14rem"
            >
              <template #body="{ data }">
                <span
                  class="payment-name-text"
                  :title="data.employeeName || '—'"
                >
                  {{ data.employeeName || '—' }}
                </span>
              </template>
            </Column>

            <Column
              field="departmentName"
              :header="t('nav.departments')"
              style="width: 12rem; min-width: 12rem"
            >
              <template #body="{ data }">
                <span
                  class="payment-line-text"
                  :title="data.departmentName || '—'"
                >
                  {{ data.departmentName || '—' }}
                </span>
              </template>
            </Column>

            <Column
              field="positionName"
              :header="t('nav.positions')"
              style="width: 12rem; min-width: 12rem"
            >
              <template #body="{ data }">
                <span
                  class="payment-line-text"
                  :title="data.positionName || '—'"
                >
                  {{ data.positionName || '—' }}
                </span>
              </template>
            </Column>

            <Column
              field="lineName"
              :header="t('nav.lines')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span
                  class="payment-line-text"
                  :title="data.lineName || '—'"
                >
                  {{ data.lineName || '—' }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.requested')"
              style="width: 9rem; min-width: 9rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatMinutesLabel(data.requestedMinutes)"
                  class="payment-rgb-tag payment-tag-info"
                />
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.break')"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ formatMinutesLabel(data.breakMinutes) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.payable')"
              style="width: 9rem; min-width: 9rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatMinutesLabel(data.payableMinutes)"
                  class="payment-rgb-tag payment-status-active"
                />
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.otHours')"
              style="width: 9rem; min-width: 9rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatNumber(data.payableHours || actualOtTimeMinutes(data) / 60, 4) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.salary')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.monthlySalary, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.hourlyRate')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.hourlyRate, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.multiplier')"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="`${formatNumber(data.multiplier, 4)}x`"
                  class="payment-rgb-tag payment-tag-purple"
                />
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.amountUsd')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.amountUsd ?? data.amount, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.exchangeRate')"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatNumber(data.exchangeRate, 6) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.rawKhr')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-khr-text">
                  {{ formatNumber(data.amountKhrRaw, 0) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.roundedKhr')"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.amountKhrRounded, 0)"
                  class="payment-rgb-tag payment-status-active"
                />
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.roundDiffKhr')"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-khr-text">
                  {{ formatNumber(data.khrRoundDifference, 0) }}
                </span>
              </template>
            </Column>

            <Column
              v-for="denomination in denominationColumns"
              :key="denomination"
              :header="formatNumber(denomination, 0)"
              style="width: 7rem; min-width: 7rem"
            >
              <template #body="{ data }">
                <span class="payment-paper-text">
                  {{ khrPaper(data, denomination) }}
                </span>
              </template>
            </Column>

            <Column
              :header="t('payment.process.column.salaryFound')"
              style="width: 9rem; min-width: 9rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="salaryStatusLabel(data.hasSalary)"
                  class="payment-rgb-tag"
                  :class="salaryStatusTagClass(data.hasSalary)"
                />
              </template>
            </Column>
          </DataTable>
        </div>

        <div
          v-if="hasMorePaymentDetailRows"
          class="payment-lazy-footer"
        >
          <span class="ot-loaded-badge">
            {{ paymentDetailLoadedLabel }}
          </span>

          <Button
            :label="t('payment.process.action.loadMore')"
            icon="pi pi-angle-down"
            severity="secondary"
            outlined
            size="small"
            class="payment-action-button"
            @click="loadMorePaymentRows"
          />
        </div>
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
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
              :value="missingSalaryRows"
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
                field="employeeNo"
                :header="t('payment.process.column.employeeId')"
                style="width: 8rem; min-width: 8rem"
              >
                <template #body="{ data }">
                  <span class="payment-code-text">
                    {{ data.employeeNo || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="employeeName"
                :header="t('payment.process.column.employeeName')"
                style="width: 14rem; min-width: 14rem"
              >
                <template #body="{ data }">
                  <span class="payment-name-text">
                    {{ data.employeeName || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="departmentName"
                :header="t('nav.departments')"
                style="width: 12rem; min-width: 12rem"
              >
                <template #body="{ data }">
                  <span class="payment-line-text">
                    {{ data.departmentName || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="positionName"
                :header="t('nav.positions')"
                style="width: 12rem; min-width: 12rem"
              >
                <template #body="{ data }">
                  <span class="payment-line-text">
                    {{ data.positionName || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="lineName"
                :header="t('nav.lines')"
                style="width: 10rem; min-width: 10rem"
              >
                <template #body="{ data }">
                  <span class="payment-line-text">
                    {{ data.lineName || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="reason"
                :header="t('payment.process.column.reason')"
                style="width: 18rem; min-width: 18rem"
              >
                <template #body="{ data }">
                  <span
                    class="payment-reason-text"
                    :title="data.reason || '—'"
                  >
                    {{ data.reason || '—' }}
                  </span>
                </template>
              </Column>
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
              :value="warningRows"
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
                field="type"
                :header="t('payment.process.column.type')"
                style="width: 14rem; min-width: 14rem"
              >
                <template #body="{ data }">
                  <Tag
                    :value="data.type || '—'"
                    class="payment-rgb-tag payment-tag-warning"
                  />
                </template>
              </Column>

              <Column
                field="rowNo"
                :header="t('payment.process.column.row')"
                style="width: 7rem; min-width: 7rem"
              >
                <template #body="{ data }">
                  <span class="payment-meta-text">
                    {{ data.rowNo || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="employeeNo"
                :header="t('payment.process.column.employeeId')"
                style="width: 8rem; min-width: 8rem"
              >
                <template #body="{ data }">
                  <span class="payment-code-text">
                    {{ data.employeeNo || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="employeeName"
                :header="t('payment.process.column.employeeName')"
                style="width: 14rem; min-width: 14rem"
              >
                <template #body="{ data }">
                  <span class="payment-name-text">
                    {{ data.employeeName || '—' }}
                  </span>
                </template>
              </Column>

              <Column
                field="reason"
                :header="t('payment.process.column.reason')"
                style="width: 18rem; min-width: 18rem"
              >
                <template #body="{ data }">
                  <span
                    class="payment-reason-text"
                    :title="data.reason || '—'"
                  >
                    {{ data.reason || '—' }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
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
.payment-process-page {
  --payment-code-rgb: 37 99 235;
  --payment-name-rgb: 15 23 42;
  --payment-meta-rgb: 71 85 105;
  --payment-active-rgb: 34 197 94;
  --payment-inactive-rgb: 239 68 68;
  --payment-info-rgb: 59 130 246;
  --payment-warning-rgb: 245 158 11;
  --payment-muted-rgb: 100 116 139;
  --payment-purple-rgb: 168 85 247;
}

/* =========================
   Filter bar
   ========================= */

.payment-process-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  align-items: end;
}

.payment-process-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.payment-process-filter-actions > * {
  flex: 0 0 auto;
}

/* =========================
   Summary cards
   ========================= */

.payment-summary-grid {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
}

.payment-calendar-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr));
}

.payment-setup-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.payment-preview-summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
}

.payment-summary-card {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.95rem;
  background: var(--ot-surface);
  padding: 0.78rem;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
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

.summary-content {
  min-width: 0;
  flex: 1;
}

.summary-label {
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-value {
  margin-top: 0.15rem;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-blue .summary-icon {
  background: rgb(var(--payment-info-rgb) / 0.13);
  color: rgb(var(--payment-info-rgb));
}

.card-green .summary-icon {
  background: rgb(var(--payment-active-rgb) / 0.13);
  color: rgb(var(--payment-active-rgb));
}

.card-purple .summary-icon {
  background: rgb(var(--payment-purple-rgb) / 0.13);
  color: rgb(var(--payment-purple-rgb));
}

.card-orange .summary-icon {
  background: rgb(var(--payment-warning-rgb) / 0.13);
  color: rgb(var(--payment-warning-rgb));
}

.card-red .summary-icon {
  background: rgb(var(--payment-inactive-rgb) / 0.13);
  color: rgb(var(--payment-inactive-rgb));
}

/* =========================
   Text helpers
   ========================= */

.payment-code-text,
.payment-name-text,
.payment-meta-text,
.payment-line-text,
.payment-money-text,
.payment-khr-text,
.payment-paper-text,
.payment-reason-text {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

.payment-code-text {
  color: rgb(var(--payment-code-rgb));
  font-size: 0.78rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.payment-name-text {
  color: rgb(var(--payment-name-rgb));
  font-size: 0.8rem;
  font-weight: 650;
}

.payment-meta-text,
.payment-line-text,
.payment-reason-text {
  color: rgb(var(--payment-meta-rgb));
  font-size: 0.76rem;
  font-weight: 500;
}

.payment-line-text,
.payment-reason-text {
  max-width: 17rem;
}

.payment-money-text,
.payment-khr-text,
.payment-paper-text {
  color: rgb(var(--payment-name-rgb));
  font-size: 0.78rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.payment-khr-text {
  color: rgb(var(--payment-purple-rgb));
}

.payment-paper-text {
  min-width: 1.8rem;
  color: rgb(var(--payment-info-rgb));
}

/* =========================
   RGB tags
   ========================= */

.payment-rgb-tag {
  --payment-tag-rgb: var(--payment-muted-rgb);
  display: inline-flex !important;
  min-height: 1.42rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--payment-tag-rgb) / 0.28);
  border-radius: 999px;
  background: rgb(var(--payment-tag-rgb) / 0.11);
  color: rgb(var(--payment-tag-rgb) / 1);
  padding: 0.12rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 750;
  line-height: 1;
  text-align: center !important;
  vertical-align: middle;
  white-space: nowrap;
}

.payment-status-active,
.payment-day-working {
  --payment-tag-rgb: var(--payment-active-rgb);
}

.payment-status-inactive,
.payment-day-holiday {
  --payment-tag-rgb: var(--payment-inactive-rgb);
}

.payment-day-sunday,
.payment-tag-warning {
  --payment-tag-rgb: var(--payment-warning-rgb);
}

.payment-tag-info {
  --payment-tag-rgb: var(--payment-info-rgb);
}

.payment-tag-purple {
  --payment-tag-rgb: var(--payment-purple-rgb);
}

.payment-tag-muted {
  --payment-tag-rgb: var(--payment-muted-rgb);
}

/* =========================
   Tables
   ========================= */

.payment-lazy-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-top: 1px solid var(--ot-border);
  padding: 0.65rem 0.75rem;
}

:deep(.payment-preview-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.payment-preview-table.p-datatable .p-datatable-thead > tr > th),
:deep(.payment-preview-table.p-datatable .p-datatable-tbody > tr > td) {
  text-align: center !important;
  vertical-align: middle !important;
}

:deep(.payment-preview-table.p-datatable .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.payment-preview-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 58px !important;
  padding: 0.42rem 0.62rem !important;
  white-space: nowrap !important;
  font-size: 0.8rem !important;
}

:deep(.payment-preview-table.p-datatable .p-datatable-column-header-content),
:deep(.payment-preview-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.payment-preview-table.p-datatable .p-datatable-column-title),
:deep(.payment-preview-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.payment-preview-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.payment-preview-table.p-datatable .p-tag),
:deep(.payment-preview-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.payment-preview-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

:deep(.payment-action-button .p-button-label) {
  font-weight: 500 !important;
}

:deep(.payment-action-button .p-button-icon) {
  font-size: 0.76rem;
}

/* =========================
   Dark mode
   ========================= */

:global(.dark) .payment-process-page {
  --payment-name-rgb: 226 232 240;
  --payment-meta-rgb: 203 213 225;
}

:global(.dark) .payment-summary-card {
  box-shadow: none;
}

:global(.dark) .card-blue .summary-icon {
  background: rgb(var(--payment-info-rgb) / 0.18);
  color: #93c5fd;
}

:global(.dark) .card-green .summary-icon {
  background: rgb(var(--payment-active-rgb) / 0.18);
  color: #86efac;
}

:global(.dark) .card-purple .summary-icon {
  background: rgb(var(--payment-purple-rgb) / 0.18);
  color: #d8b4fe;
}

:global(.dark) .card-orange .summary-icon {
  background: rgb(var(--payment-warning-rgb) / 0.18);
  color: #fdba74;
}

:global(.dark) .card-red .summary-icon {
  background: rgb(var(--payment-inactive-rgb) / 0.18);
  color: #fca5a5;
}

:global(.dark) .payment-rgb-tag {
  border-color: rgb(var(--payment-tag-rgb) / 0.42);
  background: rgb(var(--payment-tag-rgb) / 0.18);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .payment-process-filter-actions {
    justify-content: stretch;
  }

  .payment-process-filter-actions > * {
    flex: 1 1 100%;
  }

  .payment-lazy-footer {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (min-width: 1024px) {
  .payment-process-filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .payment-process-filter-bar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .payment-process-filter-bar {
    grid-template-columns:
      minmax(170px, 1fr)
      minmax(170px, 1fr)
      minmax(240px, 1.2fr)
      minmax(260px, 1.3fr)
      minmax(220px, 1.1fr);
  }

  .payment-process-filter-actions {
    grid-column: 1 / -1;
  }
}
</style>