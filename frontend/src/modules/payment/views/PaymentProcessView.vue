<!-- frontend/src/modules/payment/views/PaymentProcessView.vue -->
<script setup>
// frontend/src/modules/payment/views/PaymentProcessView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputNumber from 'primevue/inputnumber'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import { getHolidayLookupOptions } from '@/modules/calendar/holiday.api'
import {
  downloadPaymentProcessJobResult,
  downloadSalaryTemplate,
  getPaymentFormulaLookupOptions,
  getPaymentApprovalRule,
  getPaymentProcessJobStatus,
  startPaymentExportJob,
  startPaymentPreviewJob,
} from '@/modules/payment/payment.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { formatDate } from '@/shared/utils/dateFormat'

const toast = useToast()

const DETAIL_PAGE_SIZE = 20
const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]

const formulaOptions = ref([])
const loadingFormulas = ref(false)
const paymentApprovalRule = ref(null)
const loadingPaymentApprovalRule = ref(false)

const downloadingTemplate = ref(false)
const previewing = ref(false)
const generating = ref(false)

const loadingCalendar = ref(false)
const periodHolidayRows = ref([])
const selectedPaymentDates = ref([])

const salaryFile = ref(null)
const salaryFileInput = ref(null)

const previewDone = ref(false)
const previewResult = ref(null)
const detailLoadedCount = ref(DETAIL_PAGE_SIZE)

const processProgress = reactive({
  visible: false,
  type: '',
  jobId: '',
  status: '',
  progress: 1,
  phase: '',
  message: '',
  uploadProgress: 0,
  meta: {},
})

const form = reactive({
  fromDate: '',
  toDate: '',
  formulaId: '',
  exchangeRate: 4000,
})

let calendarTimer = null
let paymentProcessRunId = 0


const selectedFormula = computed(() => {
  const id = s(form.formulaId)

  return (
    formulaOptions.value.find((item) => s(item.id || item._id || item.value) === id) ||
    null
  )
})

const manualExchangeRate = computed(() => {
  const rate = Number(form.exchangeRate || 0)
  return Number.isFinite(rate) && rate > 0 ? rate : 0
})

const periodStartYMD = computed(() => normalizeYMD(form.fromDate))
const periodEndYMD = computed(() => normalizeYMD(form.toDate))

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

const paymentDetailLoadedLabel = computed(() => {
  return `Loaded ${visiblePaymentDetailRows.value.length} of ${paymentDetailRows.value.length}`
})

const paymentDetailLookup = computed(() => {
  const map = new Map()

  paymentDetailRows.value.forEach((row) => {
    addPaymentDetailLookupKeys(map, row)
  })

  return map
})

const currentPaymentApproval = computed(() => {
  return previewResult.value?.paymentApproval || paymentApprovalRule.value || {
    paymentRequiresFinalApproval: false,
    paymentApprovalMode: 'ALLOW_WITHOUT_FINAL_APPROVAL',
  }
})

const paymentRequiresFinalApproval = computed(() =>
  currentPaymentApproval.value?.paymentRequiresFinalApproval === true,
)

const paymentApprovalRuleLabel = computed(() =>
  paymentRequiresFinalApproval.value
    ? 'Final approval required'
    : 'Payment without approval allowed',
)

const approvalRequiredRows = computed(() => {
  const rows = previewResult.value?.issues?.approvalRequiredEmployees || []
  return Array.isArray(rows) ? rows : []
})

const missingSalaryRows = computed(() => {
  const rows = previewResult.value?.issues?.missingSalaryEmployees || []
  return Array.isArray(rows) ? rows : []
})

const warningRows = computed(() => {
  const invalidRows = asArray(previewResult.value?.issues?.invalidSalaryRows)
  const duplicateRows = asArray(previewResult.value?.issues?.duplicateSalaryRows)
  const missingPayableRows = asArray(
    previewResult.value?.issues?.missingPayableEmployees,
  )
  const payableWarningRows = asArray(
    previewResult.value?.issues?.payableWarningEmployees,
  )
  const approvalRequiredRows = asArray(
    previewResult.value?.issues?.approvalRequiredEmployees,
  )

  return [
    ...invalidRows.map((row) => ({
      type: 'Invalid salary row',
      rowNo: row.rowNo || row.excelRowNo || '',
      employeeNo: row.employeeNo || '',
      employeeName: row.name || row.employeeName || '',
      reason: row.reason || 'Invalid salary row',
    })),

    ...duplicateRows.map((row) => ({
      type: 'Duplicate salary row',
      rowNo: row.rowNo || row.excelRowNo || '',
      employeeNo: row.employeeNo || '',
      employeeName: row.name || row.employeeName || '',
      reason: row.reason || 'Duplicate salary row',
    })),

    ...missingPayableRows.map((row) => ({
      ...row,
      type: 'No payable minutes',
      rowNo: '',
      employeeNo: row.employeeNo || '',
      employeeName: row.employeeName || '',
      reason: row.reason || 'No attendance/policy payable minutes found',
    })),

    ...payableWarningRows.map((row) => ({
      ...row,
      type: 'Payable warning',
      rowNo: '',
      employeeNo: row.employeeNo || '',
      employeeName: row.employeeName || '',
      reason: row.reason || 'Payable minutes calculated with warning',
    })),

    ...approvalRequiredRows.map((row) => ({
      ...row,
      type: 'Approval required',
      rowNo: '',
      employeeNo: row.employeeNo || '',
      employeeName: row.employeeName || '',
      reason: row.reason || 'Payment skipped because final OT approval is required.',
    })),
  ]
})

const paymentIssueRows = computed(() => {
  const missingSalaryIssues = missingSalaryRows.value.map((row) => ({
    ...row,
    type: 'Missing salary',
    rowNo: row.rowNo || row.salaryRowNo || '',
    reason: row.reason || 'Salary not found in uploaded salary Excel',
  }))

  return [...missingSalaryIssues, ...warningRows.value].map(buildPaymentIssueRow)
})

const holidayDateSet = computed(() => {
  return new Set(periodHolidayRows.value.map((item) => s(item?.date)).filter(Boolean))
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

const selectedPaymentDateSet = computed(() => new Set(selectedPaymentDates.value))

const selectedPaymentDateCount = computed(() => selectedPaymentDates.value.length)

const excludedPaymentDateCount = computed(() =>
  Math.max(periodCalendarRows.value.length - selectedPaymentDateCount.value, 0),
)

const selectedPaymentCalendarRows = computed(() =>
  periodCalendarRows.value.map((row) => ({
    ...row,
    isSelected: selectedPaymentDateSet.value.has(row.date),
  })),
)

const denominationColumns = computed(() => {
  const source =
    previewResult.value?.exchangeRate?.denominations ||
    selectedFormula.value?.cashDenominations ||
    DEFAULT_DENOMINATIONS

  return normalizeDenominations(source)
})

const formulaCurrencyLabel = computed(() => {
  const formula = selectedFormula.value || {}
  const fromCurrency = upper(formula.currency || 'USD')
  const toCurrency = upper(formula.payoutCurrency || 'KHR')

  return `${fromCurrency} → ${toCurrency}`
})

const formulaCashPolicyLabel = computed(() => {
  const formula = selectedFormula.value || {}

  const mode = upper(formula.cashRoundingMode || 'ROUND')
  const unit = Number(formula.cashRoundingUnit || 100)
  const denominations = normalizeDenominations(
    formula.cashDenominations || DEFAULT_DENOMINATIONS,
  )

  return `${mode} / ${formatNumber(unit, 0)} · ${denominations
    .map((item) => formatNumber(item, 0))
    .join(', ')}`
})

const canPreview = computed(() => {
  return Boolean(
    periodStartYMD.value &&
      periodEndYMD.value &&
      selectedPaymentDateCount.value > 0 &&
      form.formulaId &&
      manualExchangeRate.value > 0 &&
      salaryFile.value,
  )
})

const canGenerate = computed(() => {
  return Boolean(canPreview.value && previewDone.value && previewResult.value)
})

const paymentProcessRunning = computed(() => {
  return previewing.value || generating.value
})

const processProgressLabel = computed(() => {
  const action = processProgress.type === 'EXPORT' ? 'Generating Excel' : 'Preparing preview'
  const progress = Math.round(Number(processProgress.progress || 1))
  const message = s(processProgress.message) || 'Processing payment'

  return `${action} · ${progress}% · ${message}`
})

const processProgressMetaLabel = computed(() => {
  const meta = processProgress.meta || {}
  const pieces = []

  if (Number(meta.totalRequests || 0) > 0) {
    pieces.push(`Requests ${Number(meta.processedRequests || 0)}/${Number(meta.totalRequests || 0)}`)
  }

  if (Number(meta.paymentRows || 0) > 0) {
    pieces.push(`Rows ${Number(meta.paymentRows || 0)}`)
  }

  if (Number(processProgress.uploadProgress || 0) > 0 && processProgress.status === 'UPLOADING') {
    pieces.push(`Upload ${Number(processProgress.uploadProgress || 0)}%`)
  }

  return pieces.join(' · ')
})

const summaryCards = computed(() => {
  const summary = previewSummary.value
  const formula = previewResult.value?.formula || selectedFormula.value || {}

  return [
    {
      label: 'Payable employees',
      value: summary ? Number(summary.summaryByEmployee?.length || 0) : '—',
      icon: 'pi pi-users',
      className: 'card-blue',
    },
    {
      label: 'Total OT hours',
      value: summary ? formatNumber(summary.totalPayableHours, 4) : '—',
      icon: 'pi pi-clock',
      className: 'card-green',
    },
    {
      label: 'Total OT USD',
      value: summary
        ? formatMoney(summary.totalAmountUsd ?? summary.totalAmount, formula.currency || 'USD')
        : '—',
      icon: 'pi pi-wallet',
      className: 'card-purple',
    },
    {
      label: 'Total OT KHR',
      value: summary ? `${formatNumber(summary.totalAmountKhrRounded, 0)} KHR` : '—',
      icon: 'pi pi-money-bill',
      className: 'card-green',
    },
    {
      label: 'Allowance KHR',
      value: summary ? `${formatNumber(summary.totalAllowanceKhrRounded, 0)} KHR` : '—',
      icon: 'pi pi-gift',
      className: 'card-orange',
    },
    {
      label: 'Total payable KHR',
      value: summary
        ? `${formatNumber(summary.totalPayableKhrRounded || summary.totalAmountKhrRounded, 0)} KHR`
        : '—',
      icon: 'pi pi-wallet',
      className: 'card-purple',
    },
    {
      label: 'Missing salary',
      value: summary ? Number(summary.missingSalaryItemCount || 0) : '—',
      icon: 'pi pi-exclamation-triangle',
      className: 'card-orange',
    },
    {
      label: 'Warnings',
      value: warningRows.value.length,
      icon: 'pi pi-info-circle',
      className: 'card-red',
    },
    {
      label: 'Approval required',
      value: previewResult.value
        ? Number(currentPaymentApproval.value?.excludedUnapprovedEmployeeCount || approvalRequiredRows.value.length || 0)
        : '—',
      icon: 'pi pi-lock',
      className: 'card-orange',
    },
  ]
})

watch(
  () => [periodStartYMD.value, periodEndYMD.value],
  () => {
    resetPreview()
    resetSelectedPaymentDatesToPeriod()
    scheduleCalendarLoad()
  },
)

watch(
  () => [form.formulaId, form.exchangeRate],
  () => {
    resetPreview()
  },
)

watch(
  selectedPaymentDates,
  () => {
    resetPreview()
  },
  { deep: true },
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

function normalizeFormulaOption(item = {}) {
  const id = s(item.id || item._id || item.value)
  const code = upper(item.code)
  const name = s(item.name)
  const currency = upper(item.currency || 'USD')
  const payoutCurrency = upper(item.payoutCurrency || 'KHR')

  return {
    ...item,
    id,
    code,
    name,
    label: item.label || [code, name].filter(Boolean).join(' - ') || id,
    currency,
    payoutCurrency,
    cashRoundingUnit: Number(item.cashRoundingUnit || 100),
    cashRoundingMode: upper(item.cashRoundingMode || 'ROUND'),
    cashDenominations: normalizeDenominations(
      item.cashDenominations || DEFAULT_DENOMINATIONS,
    ),
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
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
      value.getDate(),
    )}`
  }

  const raw = s(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`
}

function parseYMD(value) {
  const raw = s(value)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function getYmdDatesInRange(fromYMD, toYMD) {
  const start = parseYMD(fromYMD)
  const end = parseYMD(toYMD)

  if (!start || !end || start > end) return []

  const dates = []
  const cursor = new Date(start)

  while (cursor <= end) {
    dates.push(normalizeYMD(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function formatDateDMY(value) {
  return formatDate(value) || '—'
}

function formatNumber(value, decimals = 2) {
  const number = Number(value)

  if (!Number.isFinite(number)) return '0'

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(number)
}

function formatMoney(value, currency = '') {
  const amount = formatNumber(value, 2)
  return currency ? `${amount} ${currency}` : amount
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

  if (Number.isFinite(direct) && direct > 0) return direct

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

function khrPaper(row, denomination) {
  const key = String(denomination)

  return Number(
    row?.totalPayableKhrBreakdown?.[key] ??
      row?.khrBreakdown?.[key] ??
      0,
  )
}

function issueLookupEmployeeNo(row = {}) {
  return upper(row.employeeNo || row.employeeCode || row.staffId)
}

function issueLookupRequestNo(row = {}) {
  return upper(row.requestNo)
}

function issueLookupDate(row = {}) {
  return normalizeYMD(row.otDate || row.date || row.attendanceDate)
}

function addPaymentDetailLookupKey(map, key, row) {
  if (!key || map.has(key)) return
  map.set(key, row)
}

function addPaymentDetailLookupKeys(map, row = {}) {
  const employeeNo = issueLookupEmployeeNo(row)
  if (!employeeNo) return

  const requestNo = issueLookupRequestNo(row)
  const otDate = issueLookupDate(row)

  addPaymentDetailLookupKey(map, `${requestNo}::${employeeNo}`, row)
  addPaymentDetailLookupKey(map, `${otDate}::${employeeNo}`, row)
  addPaymentDetailLookupKey(map, employeeNo, row)
}

function findPaymentDetailForIssue(issue = {}) {
  const employeeNo = issueLookupEmployeeNo(issue)
  if (!employeeNo) return null

  const requestNo = issueLookupRequestNo(issue)
  const otDate = issueLookupDate(issue)
  const lookup = paymentDetailLookup.value

  return (
    lookup.get(`${requestNo}::${employeeNo}`) ||
    lookup.get(`${otDate}::${employeeNo}`) ||
    lookup.get(employeeNo) ||
    null
  )
}

function buildPaymentIssueRow(issue = {}) {
  const detail = findPaymentDetailForIssue(issue) || {}

  return {
    ...detail,
    ...issue,

    issueType: issue.type || issue.issueType || 'Warning',
    issueRowNo: issue.rowNo || issue.excelRowNo || issue.salaryRowNo || '',
    reason: issue.reason || detail.reason || 'Please review this payment row',

    otDate: issue.otDate || detail.otDate || '',
    otDateDisplay:
      detail.otDateDisplay ||
      (issue.otDate ? formatDateDMY(issue.otDate) : ''),
    requestNo: issue.requestNo || detail.requestNo || '',
    requestStatus: issue.requestStatus || detail.requestStatus || detail.status || '',

    employeeNo: issue.employeeNo || issue.employeeCode || detail.employeeNo || '',
    employeeName: issue.employeeName || issue.name || detail.employeeName || '',
    departmentName: issue.departmentName || detail.departmentName || '',
    positionName: issue.positionName || detail.positionName || '',
    lineName: issue.lineName || detail.lineName || '',

    dayType: issue.dayType || detail.dayType || '',
    requestedMinutes: issue.requestedMinutes ?? detail.requestedMinutes ?? 0,
    breakMinutes: issue.breakMinutes ?? detail.breakMinutes ?? 0,
    payableMinutes: issue.payableMinutes ?? detail.payableMinutes ?? 0,
    hasSalary: detail.hasSalary ?? false,
  }
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

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function normalizeJobPayload(res) {
  return normalizePayload(res) || {}
}

function resetProcessProgress() {
  processProgress.visible = false
  processProgress.type = ''
  processProgress.jobId = ''
  processProgress.status = ''
  processProgress.progress = 1
  processProgress.phase = ''
  processProgress.message = ''
  processProgress.uploadProgress = 0
  processProgress.meta = {}
}

function startProcessProgress(type) {
  processProgress.visible = true
  processProgress.type = type
  processProgress.jobId = ''
  processProgress.status = 'UPLOADING'
  processProgress.progress = 1
  processProgress.phase = 'UPLOADING'
  processProgress.message = 'Uploading salary file'
  processProgress.uploadProgress = 0
  processProgress.meta = {}
}

function updateProcessProgress(job = {}) {
  processProgress.visible = true
  processProgress.type = s(job.type || processProgress.type)
  processProgress.jobId = s(job.jobId || processProgress.jobId)
  processProgress.status = s(job.status || processProgress.status)
  processProgress.progress = Math.min(100, Math.max(1, Math.round(Number(job.progress || processProgress.progress || 1))))
  processProgress.phase = s(job.phase || processProgress.phase)
  processProgress.message = s(job.message || processProgress.message)
  processProgress.meta = job.meta || processProgress.meta || {}
}

function handleProcessUploadProgress(event) {
  if (!event?.total) return

  const uploadPercent = Math.min(100, Math.round((event.loaded / event.total) * 100))
  processProgress.uploadProgress = uploadPercent
  processProgress.progress = Math.min(10, Math.max(1, Math.round(uploadPercent / 10)))
}

async function waitForPaymentProcessJob(jobId, type, runId) {
  while (paymentProcessRunId === runId) {
    const res = await getPaymentProcessJobStatus(jobId)
    const job = normalizeJobPayload(res)

    updateProcessProgress(job)

    if (job.status === 'COMPLETED') {
      if (type === 'PREVIEW') {
        previewResult.value = job.result || null
        previewDone.value = Boolean(job.result)
        detailLoadedCount.value = DETAIL_PAGE_SIZE
      }

      return job
    }

    if (job.status === 'FAILED') {
      const message = job.error?.message || job.message || 'Payment process failed'
      throw new Error(message)
    }

    await sleep(900)
  }

  throw new Error('Payment process was stopped')
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
    selectedDates: [...selectedPaymentDates.value].sort((a, b) => a.localeCompare(b)),
    formulaId: form.formulaId,
    exchangeRate: manualExchangeRate.value,
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

  if (holidayDateSet.value.has(ymd)) return 'HOLIDAY'

  const date = parseYMD(ymd)
  if (!date) return ''

  return date.getDay() === 0 ? 'SUNDAY' : 'WORKING_DAY'
}

function dayTypeLabel(value) {
  const normalized = upper(value)

  const labels = {
    HOLIDAY: 'Holiday',
    SUNDAY: 'Sunday',
    WORKING_DAY: 'Working day',
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

function requestStatusLabel(value) {
  const normalized = upper(value)

  const labels = {
    APPROVED: 'Approved',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  }

  return labels[normalized] || normalized || '—'
}

function requestStatusTagClass(value) {
  const normalized = upper(value)

  if (normalized === 'APPROVED') return 'payment-status-active'
  if (normalized === 'PENDING') {
    return 'payment-tag-warning'
  }
  if (normalized === 'REJECTED') {
    return 'payment-status-inactive'
  }

  return 'payment-tag-muted'
}

function salaryStatusLabel(value) {
  return value ? 'Yes' : 'No'
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
      'Load failed',
      getApiErrorMessage(error, 'Failed to load payment formulas'),
    )
  } finally {
    loadingFormulas.value = false
  }
}

async function loadPaymentApprovalRule() {
  loadingPaymentApprovalRule.value = true

  try {
    const response = await getPaymentApprovalRule()
    paymentApprovalRule.value = normalizePayload(response)?.item || null
  } catch (error) {
    // The backend remains the source of truth at preview/export time. Do not block
    // payment merely because this optional explanatory badge could not load.
    paymentApprovalRule.value = null
  } finally {
    loadingPaymentApprovalRule.value = false
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

        return getHolidayLookupOptions({
          limit: 100,
          search: '',
          isActive: true,
          year,
          month,
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
      'Calendar failed',
      getApiErrorMessage(error, 'Failed to load holidays for this period'),
      3500,
    )
  } finally {
    loadingCalendar.value = false
  }
}

function resetSelectedPaymentDatesToPeriod() {
  selectedPaymentDates.value = getYmdDatesInRange(
    periodStartYMD.value,
    periodEndYMD.value,
  )
}

function selectAllPaymentDates() {
  resetSelectedPaymentDatesToPeriod()
}

function clearSelectedPaymentDates() {
  selectedPaymentDates.value = []
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

    showToast('warn', 'Invalid file', 'Please upload an Excel file only')

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
  form.exchangeRate = 4000
  periodHolidayRows.value = []
  selectedPaymentDates.value = []

  clearFile()
  resetPreview()
  resetProcessProgress()
}

async function handleDownloadTemplate() {
  downloadingTemplate.value = true

  try {
    const res = await downloadSalaryTemplate()
    downloadBlob(res, 'salary_template.xlsx')

    showToast('success', 'Downloaded', 'Salary template downloaded', 2500)
  } catch (error) {
    showToast(
      'error',
      'Download failed',
      getApiErrorMessage(error, 'Failed to download salary template'),
      3500,
    )
  } finally {
    downloadingTemplate.value = false
  }
}

function validateBeforeProcess() {
  if (!periodStartYMD.value) return 'From date is required'
  if (!periodEndYMD.value) return 'To date is required'
  if (!selectedPaymentDateCount.value) return 'Select at least one payment date'
  if (!form.formulaId) return 'Payment formula is required'
  if (manualExchangeRate.value <= 0) return 'Manual exchange rate is required'
  if (!salaryFile.value) return 'Salary Excel file is required'

  if (periodStartYMD.value > periodEndYMD.value) {
    return 'To date must be greater than or equal to from date'
  }

  return ''
}

async function handlePreview() {
  const validationMessage = validateBeforeProcess()

  if (validationMessage) {
    showToast('warn', 'Check form', validationMessage)
    return
  }

  paymentProcessRunId += 1
  const runId = paymentProcessRunId

  previewing.value = true
  resetPreview()
  startProcessProgress('PREVIEW')

  try {
    const res = await startPaymentPreviewJob(buildProcessPayload(), {
      onUploadProgress: handleProcessUploadProgress,
    })

    const startedJob = normalizeJobPayload(res)
    updateProcessProgress(startedJob)

    const completedJob = await waitForPaymentProcessJob(startedJob.jobId, 'PREVIEW', runId)
    updateProcessProgress(completedJob)

    showToast('success', 'Preview ready', 'Payment preview is ready', 2500)
  } catch (error) {
    showToast(
      'error',
      'Preview failed',
      getApiErrorMessage(error, 'Failed to preview payment'),
      4000,
    )
  } finally {
    previewing.value = false
  }
}

async function handleGenerate() {
  const validationMessage = validateBeforeProcess()

  if (validationMessage) {
    showToast('warn', 'Check form', validationMessage)
    return
  }

  if (!previewDone.value) {
    showToast('warn', 'Preview required', 'Please preview before generating Excel')
    return
  }

  paymentProcessRunId += 1
  const runId = paymentProcessRunId

  generating.value = true
  startProcessProgress('EXPORT')

  try {
    const res = await startPaymentExportJob(buildProcessPayload(), {
      onUploadProgress: handleProcessUploadProgress,
    })

    const startedJob = normalizeJobPayload(res)
    updateProcessProgress(startedJob)

    const completedJob = await waitForPaymentProcessJob(startedJob.jobId, 'EXPORT', runId)
    updateProcessProgress(completedJob)

    const downloadRes = await downloadPaymentProcessJobResult(completedJob.jobId)
    downloadBlob(
      downloadRes,
      completedJob.filename || `payment_${periodStartYMD.value}_to_${periodEndYMD.value}.xlsx`,
    )

    showToast('success', 'Generated', 'Payment Excel generated')
  } catch (error) {
    showToast(
      'error',
      'Generate failed',
      getApiErrorMessage(error, 'Failed to generate payment Excel'),
      4000,
    )
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  loadFormulaOptions()
  loadPaymentApprovalRule()
  loadInternalCalendarForPeriod()
})

onBeforeUnmount(() => {
  paymentProcessRunId += 1
  window.clearTimeout(calendarTimer)
})
</script>

<template>
  <div class="ot-page-shell payment-process-page">
    <section class="ot-filter-bar payment-process-filter-bar">
      <div class="ot-field">
        <HolidayDatePicker
          v-model="form.fromDate"
          label="From date"
          placeholder="From date"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="form.toDate"
          label="To date"
          placeholder="To date"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          Payment formula
        </label>

        <Select
          v-model="form.formulaId"
          :options="formulaOptions"
          option-label="label"
          option-value="id"
          :loading="loadingFormulas"
          placeholder="Payment formula"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          Manual rate
        </label>

        <InputNumber
          v-model="form.exchangeRate"
          :min="1"
          :min-fraction-digits="0"
          :max-fraction-digits="6"
          :use-grouping="false"
          input-class="payment-rate-input"
          class="w-full"
          size="small"
          placeholder="Example: 4000"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          Salary Excel
        </label>

        <input
          ref="salaryFileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="onFileChange"
        >

        <Button
          :label="fileName ? 'Change file' : 'Upload salary'"
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
          label="Template"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          class="payment-action-button"
          :loading="downloadingTemplate"
          @click="handleDownloadTemplate"
        />

        <Button
          label="Clear"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="payment-action-button"
          :disabled="paymentProcessRunning"
          @click="clearForm"
        />

        <Button
          label="Preview"
          icon="pi pi-eye"
          severity="info"
          size="small"
          class="payment-action-button"
          :loading="previewing"
          :disabled="!canPreview || paymentProcessRunning"
          @click="handlePreview"
        />

        <Button
          label="Generate"
          icon="pi pi-file-excel"
          size="small"
          class="payment-action-button"
          :loading="generating"
          :disabled="!canGenerate || paymentProcessRunning"
          @click="handleGenerate"
        />
      </div>
    </section>

    <section class="payment-approval-rule-banner">
      <div class="payment-approval-rule-icon">
        <i :class="paymentRequiresFinalApproval ? 'pi pi-lock' : 'pi pi-lock-open'" />
      </div>

      <div>
        <strong>{{ loadingPaymentApprovalRule ? 'Loading payment rule...' : paymentApprovalRuleLabel }}</strong>
        <span v-if="paymentRequiresFinalApproval">
          Only final Approved OT requests can be calculated. Pending requests will be skipped and listed in warnings.
        </span>
        <span v-else>
          Pending OT may be calculated and will remain visible as warnings in the payment preview.
        </span>
      </div>

      <Tag
        :value="paymentRequiresFinalApproval ? 'Strict approval' : 'Flexible approval'"
        class="payment-rgb-tag"
        :class="paymentRequiresFinalApproval ? 'payment-tag-info' : 'payment-tag-warning'"
      />
    </section>

    <section
      v-if="processProgress.visible"
      class="ot-table-card payment-progress-card"
    >
      <div class="payment-progress-header">
        <div>
          <h2 class="payment-progress-title">
            {{ processProgress.type === 'EXPORT' ? 'Generating payment Excel' : 'Preparing payment preview' }}
          </h2>

          <p class="payment-progress-message">
            {{ processProgressLabel }}
          </p>
        </div>

        <Tag
          :value="processProgress.status || 'PROCESSING'"
          class="payment-rgb-tag payment-tag-info"
        />
      </div>

      <ProgressBar
        :value="processProgress.progress"
        class="payment-progress-bar"
      />

      <div class="payment-progress-footer">
        <span>{{ processProgress.phase || 'PROCESSING' }}</span>
        <span v-if="processProgressMetaLabel">{{ processProgressMetaLabel }}</span>
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            Period calendar
          </h2>
        </div>

        <div class="ot-table-actions">
          <Tag
            :value="loadingCalendar ? 'Loading calendar...' : `${periodHolidayRows.length} holidays`"
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
              From date
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
              To date
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
              Working days
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
              Sunday
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
              Holiday
            </div>

            <div class="summary-value">
              {{ periodCalendarSummary.holidays }}
            </div>
          </div>
        </div>
      </div>

      <div class="payment-date-selection-panel">
        <div class="payment-date-selection-header">
          <div>
            <h3 class="payment-date-selection-title">
              Payment dates to calculate
            </h3>

            <p class="payment-date-selection-text">
              Keep one period above, then untick any date that must not be calculated.
            </p>
          </div>

          <div class="payment-date-selection-actions">
            <Tag
              :value="`${selectedPaymentDateCount} selected · ${excludedPaymentDateCount} excluded`"
              class="payment-rgb-tag payment-tag-info"
            />

            <Button
              label="All days"
              icon="pi pi-check-square"
              severity="secondary"
              outlined
              size="small"
              :disabled="paymentProcessRunning || !periodCalendarRows.length"
              @click="selectAllPaymentDates"
            />

            <Button
              label="Clear days"
              icon="pi pi-times"
              severity="secondary"
              outlined
              size="small"
              :disabled="paymentProcessRunning || !selectedPaymentDateCount"
              @click="clearSelectedPaymentDates"
            />
          </div>
        </div>

        <div
          v-if="selectedPaymentCalendarRows.length"
          class="payment-date-selection-grid"
        >
          <label
            v-for="row in selectedPaymentCalendarRows"
            :key="row.date"
            class="payment-date-choice"
            :class="{ 'is-excluded': !row.isSelected }"
            :for="`payment-date-${row.date}`"
          >
            <Checkbox
              v-model="selectedPaymentDates"
              :input-id="`payment-date-${row.date}`"
              :value="row.date"
              :disabled="paymentProcessRunning"
            />

            <span class="payment-date-choice-main">
              <span class="payment-date-choice-date">
                {{ formatDateDMY(row.date) }}
              </span>

              <span class="payment-date-choice-meta">
                {{ row.isSelected ? 'Will calculate' : 'Excluded from payment' }}
              </span>
            </span>

            <Tag
              :value="dayTypeLabel(row.dayType)"
              class="payment-rgb-tag"
              :class="dayTypeTagClass(row.dayType)"
            />
          </label>
        </div>

        <div
          v-else
          class="payment-date-selection-empty"
        >
          Select a valid From date and To date to choose payment dates.
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
              Payment detail
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
                  No data
                </div>

                <div class="ot-empty-text">
                  Preview payment first.
                </div>
              </div>
            </template>

            <Column
              header="Date"
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
              header="Request No"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <span class="payment-code-text">
                  {{ data.requestNo || '—' }}
                </span>
              </template>
            </Column>

            <!-- <Column
              header="OT option"
              style="width: 14rem; min-width: 14rem"
            >
              <template #body="{ data }">
                <span
                  class="payment-line-text"
                  :title="data.shiftOtOptionLabel || '—'"
                >
                  {{ data.shiftOtOptionLabel || '—' }}
                </span>
              </template>
            </Column> -->

            <!-- <Column
              header="OT time"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ formatRequestTime(data) }}
                </span>
              </template>
            </Column> -->

            <Column
              header="Day type"
              style="width: 10rem; min-width: 10rem"
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
              header="Employee ID"
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
              header="Employee name"
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
              header="Department"
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
              header="Position"
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
              header="Line"
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
              header="Requested"
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
              header="Break"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ formatMinutesLabel(data.breakMinutes) }}
                </span>
              </template>
            </Column>

            <Column
              header="Payable"
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
              header="OT hours"
              style="width: 9rem; min-width: 9rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatNumber(data.payableHours || actualOtTimeMinutes(data) / 60, 4) }}
                </span>
              </template>
            </Column>

            <Column
              header="Salary"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.monthlySalary, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              header="Hourly rate"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.hourlyRate, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              header="Formula"
              style="width: 13rem; min-width: 13rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="data.progressiveHourFormulaText || `${formatNumber(data.multiplier, 4)}x`"
                  class="payment-rgb-tag payment-tag-purple"
                />
              </template>
            </Column>

            <Column
              header="Amount USD"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.amountUsd ?? data.amount, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              header="Rate"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.exchangeRate, 6)"
                  class="payment-rgb-tag payment-tag-info"
                />
              </template>
            </Column>

            <Column
              header="Raw KHR"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-khr-text">
                  {{ formatNumber(data.amountKhrRaw, 0) }}
                </span>
              </template>
            </Column>

            <Column
              header="Rounded KHR"
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
              header="Meal"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.allowanceAmountKhrRounded || 0, 0)"
                  class="payment-rgb-tag payment-tag-warning"
                />
              </template>
            </Column>

            <Column
              header="Total KHR"
              style="width: 12rem; min-width: 12rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.totalPayableKhrRounded || data.amountKhrRounded || 0, 0)"
                  class="payment-rgb-tag payment-tag-purple"
                />
              </template>
            </Column>

            <Column
              header="Diff"
              style="width: 8rem; min-width: 8rem"
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
              header="Salary found"
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
            label="Load more"
            icon="pi pi-angle-down"
            severity="secondary"
            outlined
            size="small"
            class="payment-action-button"
            @click="loadMorePaymentRows"
          />
        </div>
      </div>

      <div class="ot-table-card">
        <div class="ot-table-toolbar">
          <div>
            <h2 class="ot-table-title">
              Payment warnings / issues
            </h2>
          </div>

          <div class="ot-table-actions">
            <span class="ot-loaded-badge">
              {{ paymentIssueRows.length }} rows
            </span>
          </div>
        </div>

        <div class="ot-table-wrapper">
          <DataTable
            :value="paymentIssueRows"
            scrollable
            scroll-height="420px"
            table-style="width: max-content; min-width: 100%; table-layout: auto;"
            class="ot-data-table ot-data-table-compact payment-preview-table"
          >
            <template #empty>
              <div class="ot-empty-state">
                <div class="ot-empty-icon">
                  <i class="pi pi-check-circle" />
                </div>

                <div class="ot-empty-title">
                  No warnings
                </div>
              </div>
            </template>

            <Column
              field="issueType"
              header="Issue"
              frozen
              header-class="payment-auto-fit-column payment-issue-column"
              body-class="payment-auto-fit-column payment-issue-column"
              style="width: max-content; min-width: max-content"
            >
              <template #body="{ data }">
                <Tag
                  :value="data.issueType || data.type || 'Warning'"
                  class="payment-rgb-tag payment-tag-warning"
                />
              </template>
            </Column>

            <Column
              field="reason"
              header="Reason"
              header-class="payment-auto-fit-column payment-reason-column"
              body-class="payment-auto-fit-column payment-reason-column"
              style="width: max-content; min-width: max-content"
            >
              <template #body="{ data }">
                <span
                  class="payment-reason-text payment-auto-fit-text"
                  :title="data.reason || '—'"
                >
                  {{ data.reason || '—' }}
                </span>
              </template>
            </Column>

            <Column
              field="issueRowNo"
              header="Excel row"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ data.issueRowNo || '—' }}
                </span>
              </template>
            </Column>

            <Column
              header="Date"
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
              header="Request No"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <span class="payment-code-text">
                  {{ data.requestNo || '—' }}
                </span>
              </template>
            </Column>

            <Column
              header="Request status"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="requestStatusLabel(data.requestStatus || data.status)"
                  class="payment-rgb-tag"
                  :class="requestStatusTagClass(data.requestStatus || data.status)"
                />
              </template>
            </Column>

            <Column
              header="Day type"
              style="width: 10rem; min-width: 10rem"
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
              header="Employee ID"
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
              header="Employee name"
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
              header="Department"
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
              header="Position"
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
              header="Line"
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
              header="Requested"
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
              header="Break"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <span class="payment-meta-text">
                  {{ formatMinutesLabel(data.breakMinutes) }}
                </span>
              </template>
            </Column>

            <Column
              header="Payable"
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
              header="OT hours"
              style="width: 9rem; min-width: 9rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatNumber(data.payableHours || actualOtTimeMinutes(data) / 60, 4) }}
                </span>
              </template>
            </Column>

            <Column
              header="Salary"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.monthlySalary, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              header="Hourly rate"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.hourlyRate, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              header="Formula"
              style="width: 13rem; min-width: 13rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="data.progressiveHourFormulaText || `${formatNumber(data.multiplier, 4)}x`"
                  class="payment-rgb-tag payment-tag-purple"
                />
              </template>
            </Column>

            <Column
              header="Amount USD"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-money-text">
                  {{ formatMoney(data.amountUsd ?? data.amount, data.currency || 'USD') }}
                </span>
              </template>
            </Column>

            <Column
              header="Rate"
              style="width: 8rem; min-width: 8rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.exchangeRate, 6)"
                  class="payment-rgb-tag payment-tag-info"
                />
              </template>
            </Column>

            <Column
              header="Raw KHR"
              style="width: 10rem; min-width: 10rem"
            >
              <template #body="{ data }">
                <span class="payment-khr-text">
                  {{ formatNumber(data.amountKhrRaw, 0) }}
                </span>
              </template>
            </Column>

            <Column
              header="Rounded KHR"
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
              header="Meal"
              style="width: 11rem; min-width: 11rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.allowanceAmountKhrRounded || 0, 0)"
                  class="payment-rgb-tag payment-tag-warning"
                />
              </template>
            </Column>

            <Column
              header="Total KHR"
              style="width: 12rem; min-width: 12rem"
            >
              <template #body="{ data }">
                <Tag
                  :value="formatNumber(data.totalPayableKhrRounded || data.amountKhrRounded || 0, 0)"
                  class="payment-rgb-tag payment-tag-purple"
                />
              </template>
            </Column>

            <Column
              header="Diff"
              style="width: 8rem; min-width: 8rem"
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
              header="Salary found"
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
          Payment preview
        </div>

        <div class="ot-empty-text">
          Select period, formula, input manual rate, upload salary Excel, then preview.
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

.payment-rate-hint {
  margin-top: 0.25rem;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.1;
}

:deep(.payment-rate-input) {
  width: 100%;
  text-align: center;
  font-size: 0.78rem !important;
  font-weight: 750 !important;
  font-variant-numeric: tabular-nums;
}

/* =========================
   Payment process progress
   ========================= */

.payment-progress-card {
  padding: 0.85rem;
}

.payment-progress-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}

.payment-progress-title {
  margin: 0;
  color: var(--ot-text);
  font-size: 0.9rem;
  font-weight: 850;
  line-height: 1.15;
}

.payment-progress-message {
  margin: 0.25rem 0 0;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.25;
}

.payment-progress-bar {
  height: 0.65rem;
  overflow: hidden;
  border-radius: 999px;
}

.payment-progress-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.45rem;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 750;
  line-height: 1.2;
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
   Payment date selection
   ========================= */

.payment-date-selection-panel {
  border-top: 1px solid var(--ot-border);
  padding: 0.8rem;
}

.payment-date-selection-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.7rem;
}

.payment-date-selection-title {
  margin: 0;
  color: var(--ot-text);
  font-size: 0.84rem;
  font-weight: 800;
  line-height: 1.2;
}

.payment-date-selection-text {
  margin: 0.2rem 0 0;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.3;
}

.payment-date-selection-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.payment-date-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 215px), 1fr));
  gap: 0.55rem;
}

.payment-date-choice {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.72rem;
  background: var(--ot-surface);
  padding: 0.56rem 0.62rem;
  cursor: pointer;
}

.payment-date-choice.is-excluded {
  opacity: 0.58;
}

.payment-date-choice-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.12rem;
}

.payment-date-choice-date {
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.76rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-date-choice-meta {
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.66rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payment-date-selection-empty {
  border: 1px dashed var(--ot-border);
  border-radius: 0.72rem;
  color: var(--ot-text-muted);
  padding: 0.7rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
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

:deep(.payment-preview-table.p-datatable .payment-auto-fit-column) {
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  white-space: nowrap !important;
}

:deep(.payment-preview-table.p-datatable .payment-issue-column) {
  padding-inline: 0.75rem !important;
}

:deep(.payment-preview-table.p-datatable .payment-reason-column) {
  padding-inline: 0.85rem !important;
  text-align: left !important;
}

:deep(.payment-preview-table.p-datatable .payment-reason-column > *) {
  margin-inline: 0 !important;
}

:deep(.payment-preview-table.p-datatable .payment-reason-column .p-datatable-column-title),
:deep(.payment-preview-table.p-datatable .payment-reason-column .p-column-title) {
  justify-content: flex-start !important;
  text-align: left !important;
}

:deep(.payment-preview-table.p-datatable .payment-reason-column .p-datatable-column-header-content),
:deep(.payment-preview-table.p-datatable .payment-reason-column .p-column-header-content) {
  justify-content: flex-start !important;
}

.payment-auto-fit-text {
  display: inline-block;
  width: max-content;
  max-width: none;
  overflow: visible;
  white-space: nowrap;
  text-overflow: clip;
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

@media (max-width: 640px) {
  .payment-date-selection-header {
    flex-direction: column;
  }

  .payment-date-selection-actions {
    width: 100%;
    justify-content: flex-start;
  }
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
      minmax(260px, 1.1fr)
      minmax(220px, 1fr);
  }

  .payment-process-filter-actions {
    grid-column: 1 / -1;
  }
}


.payment-approval-rule-banner {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.7rem 0.85rem;
  color: var(--ot-text);
}

.payment-approval-rule-icon {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.55rem;
  background: rgba(59, 130, 246, 0.12);
  color: rgb(29, 78, 216);
}

.payment-approval-rule-banner > div:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.payment-approval-rule-banner strong {
  font-size: 0.78rem;
}

.payment-approval-rule-banner span {
  color: var(--ot-text-muted);
  font-size: 0.73rem;
  line-height: 1.35;
}

@media (max-width: 680px) {
  .payment-approval-rule-banner {
    align-items: flex-start;
  }

  .payment-approval-rule-banner :deep(.p-tag) {
    display: none;
  }
}
</style>