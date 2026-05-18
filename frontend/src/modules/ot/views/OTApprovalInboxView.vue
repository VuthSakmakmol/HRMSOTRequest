<!-- frontend/src/modules/ot/views/OTApprovalInboxView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTApprovalInboxView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'
import {
  decideOTRequest,
  exportOTApprovalInboxExcel,
  getOTApprovalInbox,
} from '@/modules/ot/ot.api'

const { t } = useI18n()
const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const expandedRows = ref({})
const selectedRequestIds = ref([])

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const exporting = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: '',
  otDateTo: '',
})

const decisionDialog = reactive({
  visible: false,
  loading: false,
  action: 'APPROVE',
  remark: '',
  row: null,
})

const bulkDialog = reactive({
  visible: false,
  loading: false,
  remark: '',
  rows: [],
})

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('ot.status.pending'), value: 'PENDING' },
  {
    label: t('ot.status.pendingRequesterConfirmation'),
    value: 'PENDING_REQUESTER_CONFIRMATION',
  },
  { label: t('ot.status.approved'), value: 'APPROVED' },
  { label: t('ot.status.rejected'), value: 'REJECTED' },
  { label: t('ot.status.requesterDisagreed'), value: 'REQUESTER_DISAGREED' },
  { label: t('ot.status.cancelled'), value: 'CANCELLED' },
])

const dayTypeOptions = computed(() => [
  { label: t('ot.requests.allDayTypes'), value: '' },
  { label: t('ot.dayType.workingDay'), value: 'WORKING_DAY' },
  { label: t('ot.dayType.sunday'), value: 'SUNDAY' },
  { label: t('ot.dayType.holiday'), value: 'HOLIDAY' },
])

const totalInbox = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)

const summaryText = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalInbox.value,
  }),
)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalInbox.value > PAGE_SIZE)

const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

const actionableLoadedRows = computed(() =>
  rows.value.filter((row) => canSelectForBulk(row)),
)

const selectedBulkRows = computed(() => {
  const selected = new Set(selectedRequestIds.value)

  return rows.value.filter(
    (row) => row && selected.has(rowIdOf(row)) && canSelectForBulk(row),
  )
})

const selectedBulkCount = computed(() => selectedBulkRows.value.length)

const allLoadedActionableSelected = computed(() => {
  if (!actionableLoadedRows.value.length) return false

  const selected = new Set(selectedRequestIds.value)

  return actionableLoadedRows.value.every((row) => selected.has(rowIdOf(row)))
})

const bulkRequestCount = computed(() => bulkDialog.rows.length)

const bulkEmployeeCount = computed(() =>
  bulkDialog.rows.reduce((total, row) => total + getEmployeeCount(row), 0),
)

const decisionIsApprove = computed(() => decisionDialog.action === 'APPROVE')
const decisionIsReject = computed(() => decisionDialog.action === 'REJECT')

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: String(row?.id || row?._id || '').trim(),
  }
}

function rowIdOf(row) {
  return String(row?.id || row?._id || '').trim()
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

function errorMessage(error, fallback = '') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.messageKey ||
    error?.response?.data?.error ||
    error?.message ||
    fallback ||
    t('common.somethingWentWrong')
  )
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateYMD(value) {
  if (!value) return undefined

  const raw = String(value || '').trim()

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) return raw

  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDateDMY(value) {
  if (!value) return '-'

  const raw = String(value || '').trim()

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return raw || '-'

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatDateTimeDMY(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')

  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  const yyyy = date.getFullYear()
  const hh = pad2(date.getHours())
  const min = pad2(date.getMinutes())

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
  }
}

function statusLabel(value, key = '') {
  if (key) return t(key)

  const normalized = upper(value)

  if (normalized === 'PENDING') return t('ot.status.pending')
  if (normalized === 'PENDING_REQUESTER_CONFIRMATION') {
    return t('ot.status.pendingRequesterConfirmation')
  }
  if (normalized === 'APPROVED') return t('ot.status.approved')
  if (normalized === 'REJECTED') return t('ot.status.rejected')
  if (normalized === 'REQUESTER_DISAGREED') return t('ot.status.requesterDisagreed')
  if (normalized === 'CANCELLED') return t('ot.status.cancelled')

  return normalized || t('common.unknown')
}

function statusTagClass(value) {
  const normalized = upper(value)

  if (normalized === 'APPROVED') return ['ot-approval-rgb-tag', 'ot-approval-tag-approved']
  if (normalized === 'REJECTED') return ['ot-approval-rgb-tag', 'ot-approval-tag-rejected']
  if (normalized === 'REQUESTER_DISAGREED') return ['ot-approval-rgb-tag', 'ot-approval-tag-rejected']
  if (normalized === 'PENDING_REQUESTER_CONFIRMATION') return ['ot-approval-rgb-tag', 'ot-approval-tag-info']
  if (normalized === 'CANCELLED') return ['ot-approval-rgb-tag', 'ot-approval-tag-muted']
  if (normalized === 'PENDING') return ['ot-approval-rgb-tag', 'ot-approval-tag-pending']

  return ['ot-approval-rgb-tag', 'ot-approval-tag-muted']
}

function dayTypeLabel(value, key = '') {
  if (key) return t(key)

  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return t('ot.dayType.holiday')
  if (normalized === 'SUNDAY') return t('ot.dayType.sunday')
  if (normalized === 'WORKING_DAY') return t('ot.dayType.workingDay')

  return normalized || t('common.unknown')
}

function dayTypeTagClass(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return ['ot-approval-rgb-tag', 'ot-approval-tag-holiday']
  if (normalized === 'SUNDAY') return ['ot-approval-rgb-tag', 'ot-approval-tag-sunday']
  if (normalized === 'WORKING_DAY') return ['ot-approval-rgb-tag', 'ot-approval-tag-working']

  return ['ot-approval-rgb-tag', 'ot-approval-tag-muted']
}

function approvalDisplay(row) {
  const display = row?.approvalDisplay || {}

  return {
    type: firstText(display.type, row?.approvalDisplayType, row?.status, 'UNKNOWN'),
    label: firstText(
      display.label,
      row?.approvalDisplayLabel,
      statusLabel(row?.status, row?.statusKey),
    ),
    subLabel: firstText(display.subLabel, row?.approvalDisplaySubLabel, ''),
    severity: firstText(display.severity, row?.approvalDisplaySeverity, ''),
  }
}

function approvalDisplayTagClass(row) {
  const display = approvalDisplay(row)
  const type = upper(display.type)
  const severity = upper(display.severity)

  if (severity === 'SUCCESS' || type.includes('APPROVED')) {
    return ['ot-approval-rgb-tag', 'approval-display-tag', 'ot-approval-tag-approved']
  }

  if (
    severity === 'DANGER' ||
    severity === 'ERROR' ||
    type.includes('REJECTED') ||
    type.includes('DISAGREED')
  ) {
    return ['ot-approval-rgb-tag', 'approval-display-tag', 'ot-approval-tag-rejected']
  }

  if (severity === 'INFO' || type.includes('CONFIRMATION')) {
    return ['ot-approval-rgb-tag', 'approval-display-tag', 'ot-approval-tag-info']
  }

  if (severity === 'WARNING' || severity === 'WARN' || type.includes('PENDING')) {
    return ['ot-approval-rgb-tag', 'approval-display-tag', 'ot-approval-tag-pending']
  }

  if (type.includes('CANCELLED')) {
    return ['ot-approval-rgb-tag', 'approval-display-tag', 'ot-approval-tag-muted']
  }

  return statusTagClass(row?.status)
}

function isLegacyManualMode(row) {
  const shiftId = String(row?.shiftId || '').trim()
  const shiftOtOptionId = String(row?.shiftOtOptionId || '').trim()

  return !shiftId && !shiftOtOptionId
}

function timingSourceLabel(row) {
  const source = upper(row?.otTimingSource || row?.timingSource || 'SHIFT_OPTION')

  if (source === 'CUSTOM_FIXED') return t('ot.requests.customFixed')
  return t('ot.requests.preset')
}

function timingSourceTagClass(row) {
  const source = upper(row?.otTimingSource || row?.timingSource || 'SHIFT_OPTION')

  if (source === 'CUSTOM_FIXED') return ['ot-approval-rgb-tag', 'ot-approval-tag-info']

  return ['ot-approval-rgb-tag', 'ot-approval-tag-muted']
}

function formatTimeRange(row) {
  const start = String(row?.requestStartTime || row?.startTime || '').trim()
  const end = String(row?.requestEndTime || row?.endTime || '').trim()

  if (!start && !end) return '-'

  return [start, end].filter(Boolean).join(' - ')
}

function formatOtOptionLabel(row) {
  const label = String(row?.shiftOtOptionLabel || '').trim()

  if (label) return label

  return isLegacyManualMode(row) ? t('ot.approval.legacyManual') : '-'
}

function formatMinutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return t('ot.common.minuteValue', { value: 0 })

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) {
    return t('ot.common.hourMinuteValue', {
      hours,
      minutes: mins,
    })
  }

  if (hours) return t('ot.common.hourValue', { value: hours })

  return t('ot.common.minuteValue', { value: mins })
}

function formatRequester(row) {
  const name = String(
    row?.requesterName ||
      row?.createdByName ||
      row?.ownerName ||
      row?.employeeName ||
      '',
  ).trim()

  const employeeNo = String(
    row?.requesterEmployeeNo ||
      row?.requesterEmployeeCode ||
      row?.createdByEmployeeNo ||
      row?.employeeNo ||
      '',
  ).trim()

  return {
    name: name || '-',
    employeeNo: employeeNo || '-',
  }
}

function getTargetEmployees(row) {
  if (Array.isArray(row?.employees)) return row.employees
  if (Array.isArray(row?.approvedEmployees)) return row.approvedEmployees
  if (Array.isArray(row?.requestedEmployees)) return row.requestedEmployees
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList

  return []
}

function getEmployeeCount(row) {
  const explicitCount = Number(
    row?.employeeCount ||
      row?.approvedEmployeeCount ||
      row?.requestedEmployeeCount ||
      row?.totalEmployees ||
      0,
  )

  if (explicitCount > 0) return explicitCount

  return getTargetEmployees(row).length
}

function employeeIdOf(employee) {
  return String(employee?.employeeId || employee?._id || employee?.id || '').trim()
}

function employeeNameOf(employee) {
  return String(
    employee?.employeeName ||
      employee?.displayName ||
      employee?.name ||
      employee?.fullName ||
      '-',
  ).trim() || '-'
}

function employeeCodeOf(employee) {
  return String(
    employee?.employeeCode ||
      employee?.employeeNo ||
      employee?.code ||
      employee?.loginId ||
      '-',
  ).trim() || '-'
}

function employeePositionOf(employee) {
  return String(
    employee?.positionName ||
      employee?.position?.name ||
      employee?.positionTitle ||
      '-',
  ).trim() || '-'
}

function employeeDepartmentOf(employee) {
  return String(
    employee?.departmentName ||
      employee?.department?.name ||
      '-',
  ).trim() || '-'
}

function employeeLineOf(employee, row = null) {
  const directLabel = firstText(
    employee?.lineLabel,
    employee?.productionLineLabel,
    employee?.employeeLineLabel,
    employee?.assignedLineLabel,
    employee?.lineDisplay,
    employee?.productionLineDisplay,
    employee?.lineText,
  )

  if (directLabel) return directLabel

  const code = firstText(
    employee?.lineCode,
    employee?.productionLineCode,
    employee?.employeeLineCode,
    employee?.assignedLineCode,
    employee?.line?.code,
    employee?.line?.lineCode,
    employee?.productionLine?.code,
    employee?.productionLine?.lineCode,
    employee?.productionLineId?.code,
    employee?.productionLineId?.lineCode,
    employee?.lineId?.code,
    employee?.lineId?.lineCode,
    row?.lineCode,
    row?.productionLineCode,
    row?.line?.code,
    row?.productionLine?.code,
  )

  const name = firstText(
    employee?.lineName,
    employee?.productionLineName,
    employee?.employeeLineName,
    employee?.assignedLineName,
    employee?.line?.name,
    employee?.line?.lineName,
    employee?.productionLine?.name,
    employee?.productionLine?.lineName,
    employee?.productionLineId?.name,
    employee?.productionLineId?.lineName,
    employee?.lineId?.name,
    employee?.lineId?.lineName,
    row?.lineName,
    row?.productionLineName,
    row?.line?.name,
    row?.productionLine?.name,
  )

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  const fallback = firstText(
    employee?.lineNo,
    employee?.lineNumber,
    employee?.productionLineNo,
    employee?.productionLineNumber,
    employee?.line,
    employee?.productionLine,
  )

  return fallback
}

function lineSummaryOfRow(row) {
  const employees = getTargetEmployees(row)
  const uniqueLines = Array.from(
    new Set(
      employees
        .map((employee) => employeeLineOf(employee, row))
        .map((line) => String(line || '').trim())
        .filter(Boolean),
    ),
  )

  if (uniqueLines.length === 1) return uniqueLines[0]
  if (uniqueLines.length > 1) return uniqueLines.join(', ')

  return firstText(
    row?.lineLabel,
    row?.productionLineLabel,
    row?.lineCode,
    row?.productionLineCode,
    row?.lineName,
    row?.productionLineName,
  ) || '-'
}

function employeeOtTimeOf(employee, row) {
  const employeeStart = String(
    employee?.requestStartTime ||
      employee?.startTime ||
      employee?.otStartTime ||
      employee?.approvedStartTime ||
      '',
  ).trim()

  const employeeEnd = String(
    employee?.requestEndTime ||
      employee?.endTime ||
      employee?.otEndTime ||
      employee?.approvedEndTime ||
      '',
  ).trim()

  if (employeeStart || employeeEnd) {
    return [employeeStart, employeeEnd].filter(Boolean).join(' - ')
  }

  return formatTimeRange(row)
}

function employeeBreakMinutesOf(employee, row) {
  const value = Number(
    employee?.breakMinutes ??
      employee?.otBreakMinutes ??
      employee?.approvedBreakMinutes ??
      row?.breakMinutes ??
      0,
  )

  return Number.isFinite(value) && value >= 0 ? value : 0
}

function employeeTotalMinutesOf(employee, row) {
  const value = Number(
    employee?.totalMinutes ??
      employee?.requestedMinutes ??
      employee?.otMinutes ??
      employee?.approvedMinutes ??
      row?.totalMinutes ??
      row?.requestedMinutes ??
      0,
  )

  return Number.isFinite(value) && value >= 0 ? value : 0
}

function employeeTimeModeOf(employee) {
  const mode = upper(employee?.otTimeMode || employee?.timeMode || 'DEFAULT')

  return mode === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT'
}

function employeeTimeModeLabel(employee) {
  return employeeTimeModeOf(employee) === 'CUSTOM'
    ? t('ot.requests.timeMode.custom')
    : t('ot.requests.timeMode.default')
}

function employeeTimeModeTagClass(employee) {
  return employeeTimeModeOf(employee) === 'CUSTOM'
    ? ['ot-approval-rgb-tag', 'ot-approval-tag-pending']
    : ['ot-approval-rgb-tag', 'ot-approval-tag-approved']
}

function canDecide(row) {
  return row?.canDecide === true
}

function canSelectForBulk(row) {
  if (!row) return false
  if (!canDecide(row)) return false

  return getTargetEmployees(row).some((employee) => employeeIdOf(employee))
}

function resetDecisionDialog() {
  decisionDialog.visible = false
  decisionDialog.loading = false
  decisionDialog.action = 'APPROVE'
  decisionDialog.remark = ''
  decisionDialog.row = null
}

function openDecision(row, action) {
  if (!canDecide(row)) return

  decisionDialog.visible = true
  decisionDialog.loading = false
  decisionDialog.action = action
  decisionDialog.remark = ''
  decisionDialog.row = row
}

function closeDecision() {
  if (decisionDialog.loading) return

  resetDecisionDialog()
}

function isRequestSelected(row) {
  const id = rowIdOf(row)

  return selectedRequestIds.value.includes(id)
}

function toggleRequestSelection(row, checked) {
  const id = rowIdOf(row)

  if (!id || !canSelectForBulk(row)) return

  if (checked) {
    if (selectedRequestIds.value.includes(id)) return

    selectedRequestIds.value = [...selectedRequestIds.value, id]
    return
  }

  selectedRequestIds.value = selectedRequestIds.value.filter((item) => item !== id)
}

function selectLoadedActionableRows() {
  const ids = new Set(selectedRequestIds.value)

  actionableLoadedRows.value.forEach((row) => {
    const id = rowIdOf(row)
    if (id) ids.add(id)
  })

  selectedRequestIds.value = Array.from(ids)
}

function unselectLoadedActionableRows() {
  const loadedIds = new Set(actionableLoadedRows.value.map(rowIdOf).filter(Boolean))

  selectedRequestIds.value = selectedRequestIds.value.filter((id) => !loadedIds.has(id))
}

function toggleLoadedSelection(checked) {
  if (checked) {
    selectLoadedActionableRows()
    return
  }

  unselectLoadedActionableRows()
}

function clearBulkSelection() {
  selectedRequestIds.value = []
}

function resetListViewState() {
  expandedRows.value = {}
  selectedRequestIds.value = []
}

function openBulkApproveSelected() {
  if (!selectedBulkRows.value.length) {
    toast.add({
      severity: 'warn',
      summary: t('ot.approval.noSelectedRequests'),
      detail: t('ot.approval.selectAtLeastOne'),
      life: 2500,
    })
    return
  }

  bulkDialog.visible = true
  bulkDialog.loading = false
  bulkDialog.remark = ''
  bulkDialog.rows = [...selectedBulkRows.value]
}

function closeBulkDialog() {
  if (bulkDialog.loading) return

  bulkDialog.visible = false
  bulkDialog.loading = false
  bulkDialog.remark = ''
  bulkDialog.rows = []
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTApprovalInbox(buildQuery(page))

    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow)
    const total = Number(payload?.pagination?.total || payload?.pagination?.totalRecords || 0)

    totalRecords.value = total

    if (replace) {
      const nextRows = Array.from({ length: total }, () => null)
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = nextRows
      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('common.loadFailed'),
      detail: errorMessage(error, t('ot.approval.loadFailed')),
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true, resetState = false } = {}) {
  if (resetState) {
    resetListViewState()
  }

  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
    bootstrapped.value = false
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
  })
}

function runSearchSoon() {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    reloadFirstPage({ keepVisible: true, resetState: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true, resetState: true })
}

function onDayTypeChange() {
  reloadFirstPage({ keepVisible: true, resetState: true })
}

function onDateChange() {
  reloadFirstPage({ keepVisible: true, resetState: true })
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = ''
  filters.otDateTo = ''

  reloadFirstPage({ keepVisible: true, resetState: true })
}

async function onVirtualLazyLoad(event) {
  if (!useVirtualScroll.value) return

  const first = Number(event?.first || 0)
  const last = Number(event?.last || first + PAGE_SIZE)

  const startPage = Math.floor(first / PAGE_SIZE) + 1
  const endPage = Math.floor(Math.max(last - 1, first) / PAGE_SIZE) + 1

  for (let page = startPage; page <= endPage; page += 1) {
    if (!loadedPages.value.has(page)) {
      await fetchPage(page, { silent: true })
    }
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.URL.revokeObjectURL(url)
}

async function onExportExcel() {
  try {
    exporting.value = true

    const res = await exportOTApprovalInboxExcel(buildExportQuery())

    const blob =
      res?.data instanceof Blob
        ? res.data
        : new Blob([res?.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

    downloadBlob(blob, 'ot-approval-inbox.xlsx')

    toast.add({
      severity: 'success',
      summary: t('ot.approval.exported'),
      detail: t('ot.approval.exportedSuccess'),
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.approval.exportFailed'),
      detail: errorMessage(error, t('ot.approval.exportFailed')),
      life: 3000,
    })
  } finally {
    exporting.value = false
  }
}

async function submitDecision() {
  const row = decisionDialog.row
  const id = rowIdOf(row)

  if (!id) return

  if (decisionDialog.action === 'REJECT' && !String(decisionDialog.remark || '').trim()) {
    toast.add({
      severity: 'warn',
      summary: t('common.warning'),
      detail: t('ot.approval.rejectionRemarkRequired'),
      life: 2500,
    })
    return
  }

  try {
    decisionDialog.loading = true

    await decideOTRequest(id, {
      action: decisionDialog.action,
      remark: decisionDialog.remark,
    })

    toast.add({
      severity: 'success',
      summary: t('ot.approval.decisionSuccess'),
      detail: decisionIsApprove.value
        ? t('ot.approval.approveSuccess')
        : t('ot.approval.rejectSuccess'),
      life: 2500,
    })

    resetDecisionDialog()
    await reloadFirstPage({ keepVisible: false, resetState: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.approval.decisionFailed'),
      detail: errorMessage(error, t('ot.approval.decisionFailed')),
      life: 4000,
    })

    decisionDialog.loading = false
  }
}

async function submitBulkApproval() {
  if (!bulkDialog.rows.length) return

  try {
    bulkDialog.loading = true

    let successCount = 0
    let failedCount = 0

    for (const row of bulkDialog.rows) {
      const id = rowIdOf(row)

      if (!id) {
        failedCount += 1
        continue
      }

      try {
        await decideOTRequest(id, {
          action: 'APPROVE',
          remark: bulkDialog.remark,
        })

        successCount += 1
      } catch {
        failedCount += 1
      }
    }

    if (successCount > 0) {
      toast.add({
        severity: 'success',
        summary: t('ot.approval.bulkCompleted'),
        detail:
          failedCount > 0
            ? t('ot.approval.bulkPartial', { success: successCount, failed: failedCount })
            : t('ot.approval.bulkSuccess', { count: successCount }),
        life: 3500,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: t('ot.approval.bulkFailed'),
        detail: t('ot.approval.bulkNoApproved'),
        life: 3500,
      })
    }

    closeBulkDialog()
    clearBulkSelection()
    await reloadFirstPage({ keepVisible: false, resetState: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.approval.bulkFailed'),
      detail: errorMessage(error, t('ot.approval.bulkFailed')),
      life: 4000,
    })

    bulkDialog.loading = false
  }
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false, resetState: true })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="ot-page-shell ot-approval-page">
    <section class="ot-filter-bar ot-approval-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('common.search')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('common.status') }}
        </label>

        <Select
          v-model="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('common.status')"
          class="w-full"
          size="small"
          @change="onStatusChange"
        />
      </div>

      <div class="ot-field">
        <label class="ot-field-label">
          {{ t('ot.requests.dayType') }}
        </label>

        <Select
          v-model="filters.dayType"
          :options="dayTypeOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('ot.requests.dayType')"
          class="w-full"
          size="small"
          @change="onDayTypeChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateFrom"
          :label="t('ot.requests.otDateFrom')"
          :placeholder="t('ot.requests.otDateFrom')"
          @change="onDateChange"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.otDateTo"
          :label="t('ot.requests.otDateTo')"
          :placeholder="t('ot.requests.otDateTo')"
          @change="onDateChange"
        />
      </div>

      <div class="ot-approval-filter-actions">
        <span class="ot-loaded-badge">
          {{ summaryText }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="ot-approval-action-button"
          @click="clearFilters"
        />

        <Button
          :label="t('ot.approval.exportExcel')"
          icon="pi pi-file-excel"
          severity="secondary"
          outlined
          size="small"
          class="ot-approval-action-button ot-approval-export-button"
          :loading="exporting"
          @click="onExportExcel"
        />

        <Button
          :label="
            selectedBulkCount
              ? t('ot.approval.approveSelectedWithCount', { count: selectedBulkCount })
              : t('ot.approval.approveSelected')
          "
          icon="pi pi-check"
          size="small"
          class="ot-approval-action-button"
          :disabled="!selectedBulkCount"
          @click="openBulkApproveSelected"
        />

        <Button
          v-if="selectedRequestIds.length"
          :label="t('ot.approval.clearSelection')"
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          class="ot-approval-action-button"
          @click="clearBulkSelection"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('ot.approval.inbox') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('common.updating') }}
          </span>
        </div>
      </div>

      <AppTableLoading
        v-if="firstLoading"
        :title="t('ot.approval.loading')"
        :message="t('ot.approval.fetchingRecords')"
        :rows="8"
        :columns="12"
      />

      <DataTable
        v-else
        v-model:expandedRows="expandedRows"
        :value="rows"
        data-key="id"
        lazy
        scrollable
        scroll-height="500px"
        table-style="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-approval-table ot-data-table ot-data-table-compact"
        :virtual-scroller-options="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 70,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="ot-empty-state"
          >
            <div class="ot-empty-icon">
              <i class="pi pi-inbox" />
            </div>

            <div class="ot-empty-title">
              {{ t('common.noData') }}
            </div>

            <div class="ot-empty-text">
              {{ t('ot.approval.noData') }}
            </div>
          </div>
        </template>

        <Column expander />

        <Column header="">
          <template #header>
            <div
              class="flex justify-center"
              @click.stop
            >
              <Checkbox
                binary
                :model-value="allLoadedActionableSelected"
                :disabled="!actionableLoadedRows.length"
                @update:model-value="toggleLoadedSelection"
              />
            </div>
          </template>

          <template #body="{ data }">
            <div
              v-if="data"
              class="flex justify-center"
              @click.stop
            >
              <Checkbox
                binary
                :model-value="isRequestSelected(data)"
                :disabled="!canSelectForBulk(data)"
                @update:model-value="(checked) => toggleRequestSelection(data, checked)"
              />
            </div>
          </template>
        </Column>

        <Column
          field="requestNo"
          :header="t('ot.requests.requestNo')"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="font-medium"
            >
              {{ data.requestNo || '-' }}
            </span>
          </template>
        </Column>

        <Column :header="t('ot.requests.requester')">
          <template #body="{ data }">
            <div
              v-if="data"
              class="requester-cell"
            >
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ formatRequester(data).name }}
              </div>

              <div class="text-xs text-[color:var(--ot-text-muted)]">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          field="status"
          :header="t('ot.requests.approvalStatus')"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="approval-status-cell"
            >
              <Tag
                :value="approvalDisplay(data).label"
                :class="approvalDisplayTagClass(data)"
              />
            </div>
          </template>
        </Column>

        <Column :header="t('ot.approval.requestedStaff')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="t('ot.requests.staffCount', { count: Number(data?.requestedEmployeeCount || getEmployeeCount(data)) })"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-info']"
            />
          </template>
        </Column>

        <Column
          field="otDate"
          :header="t('ot.requests.otDate')"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatDateDMY(data.otDate) }}</span>
          </template>
        </Column>

        <Column :header="t('ot.requests.otTime')">
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column :header="t('ot.requests.otOption')">
          <template #body="{ data }">
            <div
              v-if="data"
              class="ot-option-cell"
            >
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ formatOtOptionLabel(data) }}
              </div>

              <div class="text-xs text-[color:var(--ot-text-muted)]">
                {{ t('ot.approval.requested') }}:
                {{ formatMinutesLabel(data.requestedMinutes) }}
              </div>
            </div>
          </template>
        </Column>

        <Column :header="t('ot.approval.breakTime')">
          <template #body="{ data }">
            <span
              v-if="data"
              class="font-medium"
            >
              {{ formatMinutesLabel(data.breakMinutes) }}
            </span>
          </template>
        </Column>

        <Column :header="t('ot.approval.totalRequestPaid')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="formatMinutesLabel(data.totalMinutes)"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-approved']"
            />
          </template>
        </Column>

        <Column :header="t('nav.lines')">
          <template #body="{ data }">
            <span v-if="data">{{ lineSummaryOfRow(data) }}</span>
          </template>
        </Column>

        <Column :header="t('ot.requests.timing')">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="timingSourceLabel(data)"
              :class="timingSourceTagClass(data)"
            />
          </template>
        </Column>

        <Column
          field="dayType"
          :header="t('ot.requests.dayType')"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="dayTypeLabel(data.dayType, data.dayTypeKey)"
              :class="dayTypeTagClass(data.dayType)"
            />
          </template>
        </Column>

        <Column
          field="createdAt"
          :header="t('common.createdAt')"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTimeDMY(data.createdAt) }}</span>
          </template>
        </Column>

        <Column
          :header="t('common.actions')"
          frozen
          align-frozen="right"
          header-class="ot-action-column-header"
          body-class="ot-action-column-body"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="action-row"
            >
              <Button
                v-if="canDecide(data)"
                icon="pi pi-check"
                size="small"
                class="action-btn ot-approval-action-button"
                @click="openDecision(data, 'APPROVE')"
              />

              <Button
                v-if="canDecide(data)"
                icon="pi pi-times"
                size="small"
                severity="danger"
                outlined
                class="action-btn ot-approval-action-button"
                @click="openDecision(data, 'REJECT')"
              />
            </div>
          </template>
        </Column>

        <template #expansion="{ data }">
          <div class="ot-expanded-box">
            <div
              v-if="getTargetEmployees(data).length"
              class="ot-expanded-content"
            >
              <div class="ot-expanded-header">
                <div>
                  <div class="ot-expanded-title">
                    {{ t('ot.requests.employeeOtTimeDetail') }}
                  </div>

                  <div class="ot-expanded-subtitle">
                    {{ t('ot.requests.time') }}: {{ formatTimeRange(data) }}
                    · {{ t('ot.requests.otOption') }}: {{ formatOtOptionLabel(data) }}
                    · {{ t('ot.requests.break') }}: {{ formatMinutesLabel(data.breakMinutes) }}
                    · {{ t('ot.approval.paid') }}: {{ formatMinutesLabel(data.totalMinutes) }}
                  </div>
                </div>

                <Tag
                  :value="timingSourceLabel(data)"
                  :class="timingSourceTagClass(data)"
                />
              </div>

              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ t('common.no') }}</div>
                  <div>{{ t('ot.requests.employeeId') }}</div>
                  <div>{{ t('common.name') }}</div>
                  <div>{{ t('nav.positions') }}</div>
                  <div>{{ t('ot.requests.otTime') }}</div>
                  <div>{{ t('ot.requests.break') }}</div>
                  <div>{{ t('ot.approval.totalPaid') }}</div>
                  <div>{{ t('ot.requests.mode') }}</div>
                  <div>{{ t('nav.departments') }}</div>
                  <div>{{ t('nav.lines') }}</div>
                </div>

                <div
                  v-for="(employee, index) in getTargetEmployees(data)"
                  :key="employeeIdOf(employee) || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">
                    {{ index + 1 }}
                  </div>

                  <div class="cell-center cell-mono cell-wrap">
                    {{ employeeCodeOf(employee) }}
                  </div>

                  <div class="cell-center cell-strong cell-wrap">
                    {{ employeeNameOf(employee) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeePositionOf(employee) }}
                  </div>

                  <div class="cell-center cell-mono cell-wrap">
                    {{ employeeOtTimeOf(employee, data) }}
                  </div>

                  <div class="cell-center cell-mono">
                    {{ employeeBreakMinutesOf(employee, data) }}{{ t('ot.common.minShort') }}
                  </div>

                  <div class="cell-center cell-mono">
                    {{ formatMinutesLabel(employeeTotalMinutesOf(employee, data)) }}
                  </div>

                  <div class="cell-center">
                    <Tag
                      :value="employeeTimeModeLabel(employee)"
                      :class="employeeTimeModeTagClass(employee)"
                    />
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeDepartmentOf(employee) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeLineOf(employee, data) || '-' }}
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="ot-expanded-empty"
            >
              {{ t('ot.requests.noEmployeeData') }}
            </div>
          </div>
        </template>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        {{ t('common.updating') }}
      </div>
    </section>

    <Dialog
      v-model:visible="decisionDialog.visible"
      modal
      :closable="!decisionDialog.loading"
      class="ot-decision-dialog"
      :style="{ width: '82rem', maxWidth: '98vw' }"
    >
      <template #header>
        <div class="ot-decision-header">
          <div class="min-w-0">
            <div class="ot-decision-eyebrow">
              {{ t('ot.approval.decisionEyebrow') }}
            </div>

            <div class="ot-decision-title">
              {{ decisionIsApprove ? t('ot.approval.confirmApproval') : t('ot.approval.rejectRequest') }}
            </div>
          </div>

          <div
            v-if="decisionDialog.row"
            class="ot-decision-header-tags"
          >
            <Tag
              :value="decisionDialog.row.requestNo || '-'"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-info']"
            />
          </div>
        </div>
      </template>

      <div class="ot-decision-body">
        <div
          v-if="decisionDialog.row"
          class="ot-confirm-box"
        >
          <div class="ot-confirm-icon">
            <i :class="decisionIsApprove ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
          </div>

          <div class="min-w-0">
            <div class="ot-confirm-title">
              {{ decisionIsApprove ? t('ot.approval.approveQuestion') : t('ot.approval.rejectQuestion') }}
            </div>

            <div class="ot-confirm-help">
              {{ decisionIsApprove ? t('ot.approval.approveHelp') : t('ot.approval.rejectHelp') }}
            </div>
          </div>
        </div>

        <div
          v-if="decisionDialog.row"
          class="ot-confirm-info-grid"
        >
          <div class="ot-confirm-info-item">
            <span>{{ t('ot.requests.otDate') }}</span>
            <strong>{{ formatDateDMY(decisionDialog.row.otDate) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>{{ t('ot.requests.otTime') }}</span>
            <strong>{{ formatTimeRange(decisionDialog.row) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>{{ t('ot.requests.otOption') }}</span>
            <strong>{{ formatOtOptionLabel(decisionDialog.row) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>{{ t('ot.approval.breakTime') }}</span>
            <strong>{{ formatMinutesLabel(decisionDialog.row.breakMinutes) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>{{ t('ot.approval.totalRequestPaid') }}</span>
            <strong>{{ formatMinutesLabel(decisionDialog.row.totalMinutes) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>{{ t('nav.lines') }}</span>
            <strong>{{ lineSummaryOfRow(decisionDialog.row) }}</strong>
          </div>
        </div>

        <div class="ot-remark-box">
          <label class="ot-remark-label">
            {{ t('ot.approval.remark') }}
            <span
              v-if="decisionIsReject"
              class="text-red-500"
            >*</span>
          </label>

          <Textarea
            v-model.trim="decisionDialog.remark"
            rows="3"
            auto-resize
            class="w-full"
            :placeholder="decisionIsApprove ? t('ot.approval.optionalApprovalRemark') : t('ot.approval.rejectionReasonPlaceholder')"
          />
        </div>

        <div class="ot-decision-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            :disabled="decisionDialog.loading"
            @click="closeDecision"
          />

          <Button
            :label="decisionIsApprove ? t('ot.approval.yesApprove') : t('common.reject')"
            :icon="decisionIsApprove ? 'pi pi-check' : 'pi pi-times'"
            :severity="decisionIsApprove ? undefined : 'danger'"
            :loading="decisionDialog.loading"
            size="small"
            @click="submitDecision"
          />
        </div>
      </div>
    </Dialog>

    <Dialog
      v-model:visible="bulkDialog.visible"
      modal
      :closable="!bulkDialog.loading"
      class="ot-bulk-dialog"
      :style="{ width: '52rem', maxWidth: '96vw' }"
    >
      <template #header>
        <div class="ot-decision-header">
          <div class="min-w-0">
            <div class="ot-decision-eyebrow">
              {{ t('ot.approval.bulkApproval') }}
            </div>

            <div class="ot-decision-title">
              {{ t('ot.approval.approveMultiple') }}
            </div>
          </div>

          <div class="ot-decision-header-tags">
            <Tag
              :value="t('ot.approval.requestCount', { count: bulkRequestCount })"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-info']"
            />

            <Tag
              :value="t('ot.requests.staffCount', { count: bulkEmployeeCount })"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-approved']"
            />
          </div>
        </div>
      </template>

      <div class="ot-bulk-body">
        <div class="ot-bulk-warning">
          {{ t('ot.approval.bulkWarning') }}
        </div>

        <div class="ot-remark-box">
          <label class="ot-remark-label">
            {{ t('ot.approval.remark') }}
          </label>

          <Textarea
            v-model.trim="bulkDialog.remark"
            rows="3"
            auto-resize
            class="w-full"
            :placeholder="t('ot.approval.bulkRemarkPlaceholder')"
          />
        </div>

        <div class="ot-decision-footer">
          <Button
            :label="t('common.cancel')"
            text
            size="small"
            :disabled="bulkDialog.loading"
            @click="closeBulkDialog"
          />

          <Button
            :label="t('ot.approval.approveAllSelected')"
            icon="pi pi-check"
            size="small"
            :loading="bulkDialog.loading"
            :disabled="!bulkDialog.rows.length"
            @click="submitBulkApproval"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.ot-approval-page {
  --ot-approval-approved-rgb: 34 197 94;
  --ot-approval-pending-rgb: 245 158 11;
  --ot-approval-rejected-rgb: 239 68 68;
  --ot-approval-info-rgb: 59 130 246;
  --ot-approval-muted-rgb: 100 116 139;
  --ot-approval-holiday-rgb: 239 68 68;
  --ot-approval-sunday-rgb: 245 158 11;
  --ot-approval-working-rgb: 34 197 94;
}

.ot-approval-filter-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  align-items: end;
}

.ot-approval-filter-actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  min-width: 0;
}

.ot-approval-filter-actions > * {
  flex: 0 0 auto;
}

:deep(.ot-approval-action-button .p-button-icon) {
  font-size: 0.76rem;
}

:deep(.ot-approval-export-button .p-button-icon) {
  font-size: 0.72rem;
}

:deep(.ot-approval-rgb-tag) {
  --ot-approval-tag-rgb: var(--ot-approval-muted-rgb);
  min-height: 1.42rem;
  border: 1px solid rgb(var(--ot-approval-tag-rgb) / 0.28);
  background: rgb(var(--ot-approval-tag-rgb) / 0.11);
  color: rgb(var(--ot-approval-tag-rgb) / 1);
  padding: 0.12rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  border-radius: 999px;
  white-space: nowrap;
}

:deep(.ot-approval-tag-approved) {
  --ot-approval-tag-rgb: var(--ot-approval-approved-rgb);
}

:deep(.ot-approval-tag-pending) {
  --ot-approval-tag-rgb: var(--ot-approval-pending-rgb);
}

:deep(.ot-approval-tag-rejected) {
  --ot-approval-tag-rgb: var(--ot-approval-rejected-rgb);
}

:deep(.ot-approval-tag-info) {
  --ot-approval-tag-rgb: var(--ot-approval-info-rgb);
}

:deep(.ot-approval-tag-muted) {
  --ot-approval-tag-rgb: var(--ot-approval-muted-rgb);
}

:deep(.ot-approval-tag-working) {
  --ot-approval-tag-rgb: var(--ot-approval-working-rgb);
}

:deep(.ot-approval-tag-sunday) {
  --ot-approval-tag-rgb: var(--ot-approval-sunday-rgb);
}

:deep(.ot-approval-tag-holiday) {
  --ot-approval-tag-rgb: var(--ot-approval-holiday-rgb);
}

:deep(.p-tag.approval-display-tag) {
  max-width: 15rem;
}

:deep(.p-tag.approval-display-tag .p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.ot-approval-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-approval-table .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.58rem 0.68rem !important;
  white-space: nowrap !important;
  text-align: center !important;
  vertical-align: middle !important;
  font-size: 0.78rem !important;
  font-weight: 650 !important;
}

:deep(.ot-approval-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 68px !important;
  padding: 0.46rem 0.68rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  text-align: center !important;
  font-size: 0.8rem !important;
}

:deep(.ot-approval-table .p-column-header-content) {
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-approval-table .p-datatable-tbody > tr > td > *) {
  margin-left: auto !important;
  margin-right: auto !important;
}

:deep(.ot-approval-table .p-row-toggler) {
  width: 1.72rem !important;
  height: 1.72rem !important;
  margin-inline: auto !important;
}

:deep(.ot-approval-table .ot-action-column-header),
:deep(.ot-approval-table .ot-action-column-body) {
  position: sticky !important;
  right: 0 !important;
  z-index: 8 !important;
  width: 10rem !important;
  min-width: 10rem !important;
  max-width: 10rem !important;
  background: var(--ot-surface) !important;
  box-shadow: -8px 0 18px rgba(15, 23, 42, 0.06) !important;
}

:deep(.ot-approval-table .ot-action-column-header) {
  z-index: 10 !important;
  background: linear-gradient(180deg, var(--ot-surface-2), var(--ot-surface-3)) !important;
}

:global(.dark) :deep(.ot-approval-table .ot-action-column-header),
:global(.dark) :deep(.ot-approval-table .ot-action-column-body) {
  box-shadow: -8px 0 18px rgba(0, 0, 0, 0.22) !important;
}

:deep(.ot-approval-table .p-datatable-row-expansion > td) {
  height: auto !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: hidden !important;
}

.requester-cell,
.ot-option-cell {
  display: flex;
  min-width: max-content;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.approval-status-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  flex-wrap: nowrap;
  white-space: nowrap;
}

:deep(.ot-approval-table .p-button.p-button-sm) {
  padding: 0.32rem 0.54rem !important;
  font-size: 0.76rem !important;
}

:deep(.ot-approval-table .p-button.p-button-sm .p-button-icon) {
  font-size: 0.74rem !important;
}

/* Expanded employee area */
.ot-expanded-box {
  width: 100%;
  max-width: none;
  overflow: visible;
  border-top: 1px solid var(--ot-border);
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgb(var(--ot-approval-info-rgb) / 0.05), transparent),
    var(--ot-bg);
  padding: 0.55rem 0.7rem;
}

.ot-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
  margin-bottom: 0.5rem;
}

.ot-expanded-title {
  font-size: 0.8rem;
  font-weight: 650;
  color: var(--ot-text);
}

.ot-expanded-subtitle {
  margin-top: 0.08rem;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-expanded-content {
  width: 100%;
  max-width: none;
  overflow: visible;
}

.ot-expanded-responsive-table {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    2.7rem
    minmax(4.8rem, 0.55fr)
    minmax(8rem, 1.1fr)
    minmax(7rem, 0.85fr)
    minmax(6.8rem, 0.7fr)
    minmax(4.2rem, 0.42fr)
    minmax(4.8rem, 0.48fr)
    minmax(4.8rem, 0.46fr)
    minmax(7rem, 0.8fr)
    minmax(7rem, 0.8fr);
  align-items: stretch;
}

.ot-expanded-grid-row > div {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.42rem 0.48rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ot-text);
  line-height: 1.25;
  text-align: center;
}

.ot-expanded-grid-row.is-head > div {
  background: color-mix(in srgb, var(--ot-bg) 82%, transparent);
  font-size: 0.64rem;
  font-weight: 650;
  color: var(--ot-text-muted);
  white-space: nowrap;
}

.ot-expanded-grid-row:last-child > div {
  border-bottom: 0;
}

.ot-expanded-grid-row:not(.is-head):hover > div {
  background: color-mix(in srgb, var(--ot-bg) 68%, transparent);
}

.cell-center {
  justify-content: center !important;
  text-align: center !important;
}

.cell-mono {
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  font-weight: 650 !important;
}

.cell-wrap {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ot-expanded-empty {
  border: 1px dashed var(--ot-border);
  border-radius: 0.75rem;
  padding: 0.8rem;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

/* Decision dialogs */
.ot-decision-header {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.ot-decision-eyebrow {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--ot-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.ot-decision-title {
  margin-top: 0.12rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ot-text);
}

.ot-decision-header-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
}

.ot-decision-body,
.ot-bulk-body {
  display: grid;
  gap: 0.85rem;
}

.ot-confirm-box {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface-2);
  padding: 0.85rem;
}

.ot-confirm-icon {
  display: flex;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--ot-primary-soft);
  color: var(--ot-primary);
}

.ot-confirm-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ot-text);
}

.ot-confirm-help {
  margin-top: 0.18rem;
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

.ot-confirm-info-grid {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.ot-confirm-info-item {
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.65rem;
}

.ot-confirm-info-item span {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--ot-text-muted);
}

.ot-confirm-info-item strong {
  display: block;
  margin-top: 0.16rem;
  font-size: 0.8rem;
  color: var(--ot-text);
}

.ot-remark-box {
  display: grid;
  gap: 0.42rem;
}

.ot-remark-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--ot-text);
}

.ot-decision-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ot-bulk-warning {
  border: 1px solid rgb(var(--ot-approval-pending-rgb) / 0.35);
  border-radius: 0.85rem;
  background: rgb(var(--ot-approval-pending-rgb) / 0.1);
  padding: 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgb(var(--ot-approval-pending-rgb) / 1);
}

@media (min-width: 640px) {
  .ot-confirm-info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .ot-approval-filter-bar {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ot-approval-filter-actions {
    grid-column: 1 / -1;
  }

  .ot-confirm-info-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .ot-approval-filter-bar {
    grid-template-columns:
      minmax(240px, 1.2fr)
      minmax(180px, 0.85fr)
      minmax(180px, 0.85fr)
      minmax(170px, 0.8fr)
      minmax(170px, 0.8fr);
  }
}

@media (max-width: 1200px) {
  .ot-expanded-grid-row > div {
    padding: 0.4rem 0.46rem;
    font-size: 0.67rem;
  }
}

@media (max-width: 768px) {
  .ot-approval-filter-actions {
    justify-content: stretch;
  }

  .ot-approval-filter-actions > * {
    flex: 1 1 100%;
  }

  .ot-expanded-header {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-expanded-box {
    width: max-content;
    min-width: 1080px;
    max-width: none;
    padding: 0.55rem;
  }

  .ot-expanded-content {
    width: max-content;
    min-width: 1080px;
    max-width: none;
    overflow: visible;
  }

  .ot-expanded-responsive-table {
    width: max-content;
    min-width: 1080px;
    max-width: none;
    overflow: visible;
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.4rem
      5.8rem
      8.8rem
      8.2rem
      7.4rem
      4.8rem
      5.4rem
      5.4rem
      8.5rem
      9.5rem;
  }

  .ot-expanded-grid-row > div {
    padding: 0.4rem 0.48rem;
    font-size: 0.67rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.63rem;
  }

  .cell-wrap {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}
</style>