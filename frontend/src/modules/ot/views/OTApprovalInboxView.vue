<!-- frontend/src/modules/ot/views/OTApprovalInboxView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTApprovalInboxView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  decideOTRequest,
  exportOTApprovalInboxExcel,
  getOTApprovalInbox,
} from '@/modules/ot/ot.api'

const router = useRouter()
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
  otDateFrom: null,
  otDateTo: null,
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

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Pending Requester Confirmation', value: 'PENDING_REQUESTER_CONFIRMATION' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Requester Disagreed', value: 'REQUESTER_DISAGREED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const dayTypeOptions = [
  { label: 'All Day Types', value: '' },
  { label: 'Working Day', value: 'WORKING_DAY' },
  { label: 'Sunday', value: 'SUNDAY' },
  { label: 'Holiday', value: 'HOLIDAY' },
]

const totalInbox = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalInbox.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalInbox.value > PAGE_SIZE)

const decisionEmployees = computed(() => getTargetEmployees(decisionDialog.row))

const actionableLoadedRows = computed(() =>
  rows.value.filter((row) => canSelectForBulk(row)),
)

const selectedBulkRows = computed(() => {
  const selected = new Set(selectedRequestIds.value)

  return rows.value.filter((row) => row && selected.has(rowIdOf(row)) && canSelectForBulk(row))
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

function normalizeClassKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

function dayTypeClass(value) {
  return `ot-day-${normalizeClassKey(value || 'unknown')}`
}

function approvalDisplay(row) {
  return row?.approvalDisplay || {
    type: row?.approvalDisplayType || row?.status || 'UNKNOWN',
    label: row?.approvalDisplayLabel || row?.status || '-',
    subLabel: row?.approvalDisplaySubLabel || '',
    severity: row?.approvalDisplaySeverity || statusSeverity(row?.status),
  }
}

function approvalDisplayClass(row) {
  return `ot-approval-${normalizeClassKey(approvalDisplay(row).type || 'unknown')}`
}

function approvalDisplaySeverity(row) {
  const severity = approvalDisplay(row).severity

  if (severity) return severity

  const type = upper(approvalDisplay(row).type)

  if (type === 'APPROVED') return 'success'
  if (type === 'REJECTED' || type === 'REQUESTER_DISAGREED') return 'danger'
  if (type === 'WAITING' || type === 'REQUESTER_CONFIRMATION') return 'warning'
  if (type === 'CANCELLED') return 'secondary'

  return 'secondary'
}

function getTimingMode(row) {
  return upper(
    row?.shiftOtOptionTimingMode ||
      row?.timingMode ||
      row?.otTimingMode ||
      row?.shiftOtOption?.timingMode ||
      '',
  )
}

function timingModeLabel(value) {
  const normalized = upper(value)

  if (normalized === 'FIXED_TIME') return 'Fixed Time'
  if (normalized === 'AFTER_SHIFT_END') return 'After Shift End'

  return 'Timing N/A'
}

function timingSourceLabel(row) {
  const source = upper(row?.otTimingSource || row?.timingSource || 'SHIFT_OPTION')

  if (source === 'CUSTOM_FIXED') return 'Custom Fixed'
  return 'Preset'
}

function timingSourceSeverity(row) {
  const source = upper(row?.otTimingSource || row?.timingSource || 'SHIFT_OPTION')

  if (source === 'CUSTOM_FIXED') return 'info'
  return 'secondary'
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

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
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

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()

  return `${dd}/${mm}/${yyyy}`
}

function formatDateTimeDMY(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()

  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')

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

function dayTypeSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function statusSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'APPROVED') return 'success'
  if (normalized === 'REJECTED') return 'danger'
  if (normalized === 'REQUESTER_DISAGREED') return 'danger'
  if (normalized === 'PENDING_REQUESTER_CONFIRMATION') return 'info'
  if (normalized === 'CANCELLED') return 'contrast'
  if (normalized === 'PENDING') return 'warning'

  return 'secondary'
}

function isLegacyManualMode(row) {
  const shiftId = String(row?.shiftId || '').trim()
  const shiftOtOptionId = String(row?.shiftOtOptionId || '').trim()

  return !shiftId && !shiftOtOptionId
}

function requestModeLabel(row) {
  return isLegacyManualMode(row) ? 'LEGACY MANUAL' : 'SHIFT OPTION'
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

  return isLegacyManualMode(row) ? 'Legacy manual' : '-'
}

function formatRequestedMinutes(row) {
  const requestedMinutes = Number(row?.requestedMinutes || 0)

  if (requestedMinutes > 0) return `${requestedMinutes} min`

  const totalMinutes = Number(row?.totalMinutes || 0)

  if (totalMinutes > 0) return `${totalMinutes} min`

  return '-'
}

function formatMinutesLabel(value) {
  const minutes = Number(value || 0)

  if (!minutes) return '0 min'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`

  return `${mins}m`
}

function formatHours(row) {
  const totalHours = Number(row?.totalHours || 0)

  if (!Number.isFinite(totalHours) || totalHours <= 0) return '-'

  return totalHours
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
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList

  return []
}

function getEmployeeCount(row) {
  const explicitCount = Number(row?.employeeCount || row?.approvedEmployeeCount || row?.totalEmployees || 0)

  if (explicitCount > 0) return explicitCount

  return getTargetEmployees(row).length
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
  return employeeTimeModeOf(employee) === 'CUSTOM' ? 'Custom' : 'Default'
}

function employeeTimeModeSeverity(employee) {
  return employeeTimeModeOf(employee) === 'CUSTOM' ? 'warn' : 'success'
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
      summary: 'No selected requests',
      detail: 'Please select at least one actionable OT request.',
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

      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        rows.value[startIndex + i] = items[i]
      }

      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load approval inbox',
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
  filters.otDateFrom = null
  filters.otDateTo = null

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
      summary: 'Export ready',
      detail: 'Excel exported successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to export Excel.',
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
      summary: 'Validation',
      detail: 'Please enter rejection remark.',
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
      summary: 'Success',
      detail:
        decisionDialog.action === 'APPROVE'
          ? 'OT request processed successfully.'
          : 'OT request rejected successfully.',
      life: 2500,
    })

    resetDecisionDialog()
    await reloadFirstPage({ keepVisible: false, resetState: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Decision failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to process decision.',
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
        summary: 'Bulk approval completed',
        detail:
          failedCount > 0
            ? `${successCount} approved, ${failedCount} failed.`
            : `${successCount} request(s) approved successfully.`,
        life: 3500,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Bulk approval failed',
        detail: 'No request was approved.',
        life: 3500,
      })
    }

    closeBulkDialog()
    clearBulkSelection()
    await reloadFirstPage({ keepVisible: false, resetState: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Bulk approval failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to approve selected requests.',
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
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          label="Export Excel"
          icon="pi pi-file-excel"
          severity="success"
          outlined
          size="small"
          :loading="exporting"
          @click="onExportExcel"
        />

        <Button
          :label="`Approve Selected${selectedBulkCount ? ` (${selectedBulkCount})` : ''}`"
          icon="pi pi-check"
          size="small"
          :disabled="!selectedBulkCount"
          @click="openBulkApproveSelected"
        />

        <Button
          v-if="selectedRequestIds.length"
          label="Clear Selection"
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          @click="clearBulkSelection"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[220px] xl:shrink-0">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              placeholder="Search"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <Select
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              size="small"
              @change="onStatusChange"
            />
          </div>

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <Select
              v-model="filters.dayType"
              :options="dayTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Day Type"
              class="w-full"
              size="small"
              @change="onDayTypeChange"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateFrom"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date From"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateTo"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date To"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
        </div>
      </div>

      <DataTable
        v-model:expandedRows="expandedRows"
        :value="rows"
        dataKey="id"
        lazy
        scrollable
        scrollHeight="500px"
        tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-approval-table"
        :virtualScrollerOptions="useVirtualScroll ? {
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
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No OT approval requests found.
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
                :modelValue="allLoadedActionableSelected"
                :disabled="!actionableLoadedRows.length"
                @update:modelValue="toggleLoadedSelection"
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
                :modelValue="isRequestSelected(data)"
                :disabled="!canSelectForBulk(data)"
                @update:modelValue="(checked) => toggleRequestSelection(data, checked)"
              />
            </div>
          </template>
        </Column>

        <Column field="requestNo" header="Request No">
          <template #body="{ data }">
            <span v-if="data" class="font-medium">
              {{ data.requestNo || '-' }}
            </span>
          </template>
        </Column>

        <Column header="Requester">
          <template #body="{ data }">
            <div v-if="data" class="requester-cell">
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ formatRequester(data).name }}
              </div>

              <div class="text-xs text-[color:var(--ot-text-muted)]">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column field="status" header="Approval Status">
          <template #body="{ data }">
            <div v-if="data" class="approval-status-cell">
              <Tag
                :value="approvalDisplay(data).label"
                :severity="approvalDisplaySeverity(data)"
                class="ot-status-tag approval-display-tag"
                :class="approvalDisplayClass(data)"
              />
            </div>
          </template>
        </Column>

        <Column header="Requested Staff">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="`${Number(data?.requestedEmployeeCount || 0)} staff`"
              severity="secondary"
              class="ot-status-tag ot-count-requested"
            />
          </template>
        </Column>

        <Column field="otDate" header="OT Date">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateDMY(data.otDate) }}</span>
          </template>
        </Column>

        <Column header="OT Time">
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column header="Timing">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="timingSourceLabel(data)"
              :severity="timingSourceSeverity(data)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column field="dayType" header="Day Type">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.dayType || '-'"
              :severity="dayTypeSeverity(data.dayType)"
              class="ot-status-tag"
              :class="dayTypeClass(data.dayType)"
            />
          </template>
        </Column>

        <Column field="createdAt" header="Created At">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTimeDMY(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions">
          <template #body="{ data }">
            <div v-if="data" class="action-row">
              <Button
                v-if="canDecide(data)"
                label="Approve"
                icon="pi pi-check"
                size="small"
                class="action-btn"
                @click="openDecision(data, 'APPROVE')"
              />

              <Button
                v-if="canDecide(data)"
                label="Reject"
                icon="pi pi-times"
                size="small"
                severity="danger"
                outlined
                class="action-btn"
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
                    Employee OT time detail
                  </div>

                  <div class="ot-expanded-subtitle">
                    Default request time: {{ formatTimeRange(data) }}
                  </div>
                </div>

                <Tag
                  :value="timingSourceLabel(data)"
                  :severity="timingSourceSeverity(data)"
                  class="ot-status-tag"
                />
              </div>

              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>No</div>
                  <div>ID</div>
                  <div>Name</div>
                  <div>Position</div>
                  <div>OT Time</div>
                  <div>Break</div>
                  <div>Total</div>
                  <div>Mode</div>
                  <div>Line</div>
                </div>

                <div
                  v-for="(employee, index) in getTargetEmployees(data)"
                  :key="employeeIdOf(employee) || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">
                    {{ index + 1 }}
                  </div>

                  <div class="cell-mono cell-wrap">
                    {{ employeeCodeOf(employee) }}
                  </div>

                  <div class="cell-strong cell-wrap">
                    {{ employeeNameOf(employee) }}
                  </div>

                  <div class="cell-wrap">
                    {{ employeePositionOf(employee) }}
                  </div>

                  <div class="cell-center cell-mono cell-wrap">
                    {{ employeeOtTimeOf(employee, data) }}
                  </div>

                  <div class="cell-center cell-mono">
                    {{ employeeBreakMinutesOf(employee, data) }}m
                  </div>

                  <div class="cell-center cell-mono">
                    {{ formatMinutesLabel(employeeTotalMinutesOf(employee, data)) }}
                  </div>

                  <div class="cell-center">
                    <Tag
                      :value="employeeTimeModeLabel(employee)"
                      :severity="employeeTimeModeSeverity(employee)"
                      class="ot-status-tag"
                    />
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeLineOf(employee, data) || '-' }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="ot-expanded-empty">
              No employee data found for this request.
            </div>
          </div>
        </template>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>

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
              OT approval decision
            </div>

            <div class="ot-decision-title">
              {{ decisionDialog.action === 'APPROVE' ? 'Confirm Approval' : 'Reject OT Request' }}
            </div>
          </div>

          <div
            v-if="decisionDialog.row"
            class="ot-decision-header-tags"
          >
            <Tag
              :value="decisionDialog.row.requestNo || '-'"
              severity="info"
              class="ot-status-tag"
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
            <i :class="decisionDialog.action === 'APPROVE' ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
          </div>

          <div class="min-w-0">
            <div class="ot-confirm-title">
              {{ decisionDialog.action === 'APPROVE' ? 'Are you sure you want to approve?' : 'Are you sure you want to reject?' }}
            </div>

            <div class="ot-confirm-help">
              {{ decisionDialog.action === 'APPROVE'
                ? 'This will approve all employees inside this OT request.'
                : 'This will reject the whole OT request.' }}
            </div>
          </div>
        </div>

        <div
          v-if="decisionDialog.row"
          class="ot-confirm-info-grid"
        >
          <div class="ot-confirm-info-item">
            <span>OT Date</span>
            <strong>{{ formatDateDMY(decisionDialog.row.otDate) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>OT Time</span>
            <strong>{{ formatTimeRange(decisionDialog.row) }}</strong>
          </div>

          <div class="ot-confirm-info-item">
            <span>Line</span>
            <strong>{{ lineSummaryOfRow(decisionDialog.row) }}</strong>
          </div>
        </div>

        <div class="ot-remark-box">
          <label class="ot-remark-label">
            Remark
            <span
              v-if="decisionDialog.action === 'REJECT'"
              class="text-red-500"
            >*</span>
          </label>

          <Textarea
            v-model.trim="decisionDialog.remark"
            rows="3"
            autoResize
            class="w-full"
            :placeholder="
              decisionDialog.action === 'APPROVE'
                ? 'Optional approval remark'
                : 'Please enter rejection reason'
            "
          />
        </div>

        <div class="ot-decision-footer">
          <Button
            label="Cancel"
            text
            size="small"
            :disabled="decisionDialog.loading"
            @click="closeDecision"
          />

          <Button
            :label="decisionDialog.action === 'APPROVE' ? 'Yes, Approve' : 'Reject'"
            :icon="decisionDialog.action === 'APPROVE' ? 'pi pi-check' : 'pi pi-times'"
            :severity="decisionDialog.action === 'APPROVE' ? undefined : 'danger'"
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
              Bulk approval
            </div>

            <div class="ot-decision-title">
              Approve multiple OT requests
            </div>
          </div>

          <div class="ot-decision-header-tags">
            <Tag
              :value="`${bulkRequestCount} request(s)`"
              severity="info"
              class="ot-status-tag"
            />

            <Tag
              :value="`${bulkEmployeeCount} staff`"
              severity="success"
              class="ot-status-tag ot-status-approved"
            />
          </div>
        </div>
      </template>

      <div class="ot-bulk-body">
        <div class="ot-bulk-warning">
          Are you sure you want to approve the selected OT requests?
          This will approve all employees inside each selected request.
        </div>

        <div class="ot-remark-box">
          <label class="ot-remark-label">
            Remark
          </label>

          <Textarea
            v-model.trim="bulkDialog.remark"
            rows="3"
            autoResize
            class="w-full"
            placeholder="Optional remark for all selected approvals"
          />
        </div>

        <div class="ot-decision-footer">
          <Button
            label="Cancel"
            text
            size="small"
            :disabled="bulkDialog.loading"
            @click="closeBulkDialog"
          />

          <Button
            label="Approve All Selected"
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
:deep(.ot-approval-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-approval-table .p-datatable-thead > tr > th) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  padding: 0.62rem 0.72rem !important;
  white-space: nowrap !important;
}

:deep(.ot-approval-table .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 70px !important;
  padding: 0.5rem 0.72rem !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

/* Expanded employee area */
:deep(.ot-approval-table .p-datatable-row-expansion > td) {
  height: auto !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: hidden !important;
}

.ot-expanded-box {
  position: sticky;
  left: 0;
  width: min(100%, 1120px);
  max-width: none;
  overflow: visible;
  border-top: 1px solid var(--ot-border);
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.05), transparent),
    var(--ot-bg);
  padding: 0.75rem;
}

.ot-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.ot-expanded-title {
  font-size: 0.82rem;
  font-weight: 600;
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
  border-radius: 0.85rem;
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
    minmax(7rem, 0.8fr);
  align-items: stretch;
}

.ot-expanded-grid-row > div {
  min-width: 0;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.46rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text);
  line-height: 1.28;
}

.ot-expanded-grid-row.is-head > div {
  background: color-mix(in srgb, var(--ot-bg) 82%, transparent);
  font-size: 0.66rem;
  font-weight: 600;
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
  justify-content: center;
  text-align: center;
}

.cell-mono {
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  font-weight: 600 !important;
}

.cell-wrap {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ot-expanded-empty {
  border: 1px dashed var(--ot-border);
  border-radius: 0.75rem;
  padding: 0.85rem;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

@media (max-width: 1200px) {
  .ot-expanded-box {
    width: min(100%, 1060px);
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.5rem
      minmax(4.5rem, 0.52fr)
      minmax(7rem, 1fr)
      minmax(6.5rem, 0.75fr)
      minmax(6.4rem, 0.62fr)
      minmax(4rem, 0.4fr)
      minmax(4.6rem, 0.46fr)
      minmax(4.6rem, 0.44fr)
      minmax(6.8rem, 0.76fr);
  }

  .ot-expanded-grid-row > div {
    padding: 0.42rem 0.46rem;
    font-size: 0.68rem;
  }
}

@media (max-width: 768px) {
  .ot-expanded-header {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-expanded-box {
    width: max-content;
    min-width: 980px;
    max-width: none;
    padding: 0.6rem;
  }

  .ot-expanded-content {
    width: max-content;
    min-width: 980px;
    max-width: none;
    overflow: visible;
  }

  .ot-expanded-responsive-table {
    width: max-content;
    min-width: 980px;
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
      4.4rem
      5.2rem
      5.2rem
      10rem;
  }

  .ot-expanded-grid-row > div {
    padding: 0.42rem 0.5rem;
    font-size: 0.68rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.64rem;
  }

  .cell-wrap {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

@media (max-width: 420px) {
  .ot-expanded-box {
    width: max-content;
    min-width: 980px;
    max-width: none;
    padding: 0.55rem;
  }

  .ot-expanded-content {
    width: max-content;
    min-width: 980px;
    max-width: none;
  }

  .ot-expanded-responsive-table {
    width: max-content;
    min-width: 980px;
    max-width: none;
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.3rem
      5.6rem
      8.5rem
      8rem
      7.2rem
      4.3rem
      5.1rem
      5.1rem
      10rem;
  }

  .ot-expanded-grid-row > div {
    padding: 0.4rem 0.46rem;
    font-size: 0.66rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.62rem;
  }
}

/* Main table compact styles */
:deep(.ot-approval-table .p-column-header-content) {
  width: max-content;
  white-space: nowrap;
}

:deep(.ot-approval-table .p-row-toggler) {
  width: 1.75rem !important;
  height: 1.75rem !important;
}

:deep(.ot-approval-table .p-checkbox) {
  width: 1rem !important;
  height: 1rem !important;
}

:deep(.ot-approval-table .p-checkbox-box) {
  width: 1rem !important;
  height: 1rem !important;
}

.requester-cell {
  min-width: max-content;
}

.approval-status-cell {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: nowrap;
  white-space: nowrap;
}

:deep(.ot-approval-table .p-button.p-button-sm),
:deep(.action-btn.p-button) {
  min-height: 1.85rem !important;
  padding: 0.3rem 0.52rem !important;
  border-radius: 0.55rem !important;
  font-size: 0.74rem !important;
}

:deep(.ot-approval-table .p-button.p-button-sm .p-button-icon),
:deep(.action-btn .p-button-icon) {
  font-size: 0.72rem !important;
}

:deep(.action-btn .p-button-label) {
  font-weight: 500 !important;
}

:deep(.ot-approval-table .p-tag.ot-status-tag),
:deep(.p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  border: 1px solid transparent !important;
  border-radius: 999px !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}

:deep(.p-tag.approval-display-tag) {
  max-width: 15rem;
}

:deep(.p-tag.approval-display-tag .p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Decision dialog */
:deep(.ot-decision-dialog .p-dialog-header),
:deep(.ot-bulk-dialog .p-dialog-header) {
  border-bottom: 1px solid var(--ot-border);
  padding: 0.9rem 1rem !important;
}

:deep(.ot-decision-dialog .p-dialog-content),
:deep(.ot-bulk-dialog .p-dialog-content) {
  background: var(--ot-bg) !important;
  padding: 0.85rem !important;
}

.ot-decision-header {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ot-decision-eyebrow {
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.ot-decision-title {
  margin-top: 0.12rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-decision-header-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
}

.ot-decision-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ot-decision-summary {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.8rem;
}

.ot-summary-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  padding-bottom: 0.65rem;
}

.ot-summary-request-no {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-summary-owner {
  text-align: right;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-summary-owner span {
  display: block;
  margin-top: 0.08rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.65rem;
}

.ot-summary-item {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: 0.75rem;
  background: var(--ot-bg);
  padding: 0.55rem 0.65rem;
}

.ot-summary-item span {
  display: block;
  font-size: 0.66rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-summary-item strong {
  display: block;
  overflow: hidden;
  margin-top: 0.15rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.65rem;
}

.ot-adjust-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.75rem 0.85rem;
}

.ot-adjust-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-adjust-help {
  margin-top: 0.12rem;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-adjust-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem;
  align-items: flex-start;
}

.ot-adjust-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.75rem;
}

.ot-adjust-panel.is-allowed {
  border-color: color-mix(in srgb, #22c55e 34%, var(--ot-border));
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.08), transparent),
    var(--ot-surface);
}

.ot-adjust-panel.is-removed {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--ot-border));
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.08), transparent),
    var(--ot-surface);
}

.ot-adjust-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  padding-bottom: 0.6rem;
}

.ot-panel-title {
  display: flex;
  align-items: center;
  gap: 0.38rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-panel-title i {
  font-size: 0.78rem;
  color: var(--ot-text-muted);
}

.ot-adjust-panel-header p {
  margin-top: 0.12rem;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-adjust-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  gap: 0.5rem;
  margin-top: 0.65rem;
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.15rem;
}

.ot-adjust-card {
  position: relative;
  min-height: 7.2rem;
  cursor: pointer;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.62rem 0.62rem 0.58rem;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.ot-adjust-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.ot-adjust-card:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.ot-adjust-card.is-allowed {
  border-color: color-mix(in srgb, #22c55e 40%, var(--ot-border));
}

.ot-adjust-card.is-removed {
  border-color: color-mix(in srgb, #f59e0b 45%, var(--ot-border));
}

.ot-adjust-card-icon {
  position: absolute;
  top: 0.52rem;
  right: 0.52rem;
  display: inline-flex;
  width: 1.35rem;
  height: 1.35rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.62rem;
}

.ot-adjust-card.is-allowed .ot-adjust-card-icon {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.ot-adjust-card.is-removed .ot-adjust-card-icon {
  background: rgba(245, 158, 11, 0.18);
  color: #b45309;
}

.ot-adjust-card-main {
  display: block;
  min-width: 0;
  padding-right: 1.6rem;
}

.ot-adjust-card-main strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-adjust-card-main em {
  display: block;
  margin-top: 0.12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-adjust-card-meta {
  display: block;
  overflow: hidden;
  margin-top: 0.22rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-adjust-card-action {
  display: inline-flex;
  margin-top: 0.48rem;
  border-radius: 999px;
  padding: 0.16rem 0.42rem;
  font-size: 0.62rem;
  font-weight: 600;
}

.ot-adjust-card.is-allowed .ot-adjust-card-action {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.ot-adjust-card.is-removed .ot-adjust-card-action {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.ot-adjust-empty {
  display: flex;
  min-height: 12rem;
  align-items: center;
  justify-content: center;
  margin-top: 0.65rem;
  border: 1px dashed var(--ot-border);
  border-radius: 0.85rem;
  padding: 1rem;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-confirm-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  border: 1px solid color-mix(in srgb, #22c55e 36%, var(--ot-border));
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.1), transparent),
    var(--ot-surface);
  padding: 0.85rem;
}

.ot-confirm-icon {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.14);
  color: #16a34a;
  font-size: 1rem;
}

.ot-confirm-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-confirm-help {
  margin-top: 0.12rem;
  font-size: 0.76rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-confirm-info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.ot-confirm-info-item {
  min-width: 0;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.7rem 0.75rem;
}

.ot-confirm-info-item span {
  display: block;
  margin-bottom: 0.2rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--ot-text-muted);
}

.ot-confirm-info-item strong {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ot-text);
  line-height: 1.3;
  overflow-wrap: anywhere;
  word-break: break-word;
}

:global(.dark) .ot-confirm-icon {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
}

.ot-remark-box {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.8rem;
}

.ot-remark-label {
  display: block;
  margin-bottom: 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-decision-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Bulk dialog */
.ot-bulk-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ot-bulk-warning {
  border: 1px solid color-mix(in srgb, #f59e0b 42%, var(--ot-border));
  border-radius: 0.9rem;
  background: rgba(245, 158, 11, 0.08);
  padding: 0.7rem 0.8rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--ot-text);
}

.ot-bulk-list {
  display: grid;
  gap: 0.45rem;
  max-height: 18rem;
  overflow: auto;
}

.ot-bulk-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
  padding: 0.62rem 0.7rem;
}

.ot-bulk-item strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-bulk-item span {
  display: block;
  margin-top: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

/* Status colors */
:deep(.p-tag.ot-status-pending),
:deep(.p-tag.ot-status-pending-requester-confirmation),
:deep(.p-tag.ot-approval-waiting),
:deep(.p-tag.ot-approval-requester-confirmation) {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #f59e0b !important;
}

:deep(.p-tag.ot-status-approved),
:deep(.p-tag.ot-approval-approved) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-status-rejected),
:deep(.p-tag.ot-status-requester-disagreed),
:deep(.p-tag.ot-approval-rejected),
:deep(.p-tag.ot-approval-requester-disagreed) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-status-cancelled),
:deep(.p-tag.ot-approval-cancelled) {
  background: #e5e7eb !important;
  color: #374151 !important;
  border-color: #9ca3af !important;
}

/* Day type colors */
:deep(.p-tag.ot-day-working-day) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-day-sunday) {
  background: #ffedd5 !important;
  color: #9a3412 !important;
  border-color: #f97316 !important;
}

:deep(.p-tag.ot-day-holiday) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

/* Count colors */
:deep(.p-tag.ot-count-requested) {
  background: #f1f5f9 !important;
  color: #334155 !important;
  border-color: #cbd5e1 !important;
}

:deep(.p-tag.ot-count-approved) {
  background: #e0f2fe !important;
  color: #075985 !important;
  border-color: #38bdf8 !important;
}

/* Dark mode */
:global(.dark) :deep(.p-tag.ot-status-pending),
:global(.dark) :deep(.p-tag.ot-status-pending-requester-confirmation),
:global(.dark) :deep(.p-tag.ot-approval-waiting),
:global(.dark) :deep(.p-tag.ot-approval-requester-confirmation) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-approved),
:global(.dark) :deep(.p-tag.ot-approval-approved) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-rejected),
:global(.dark) :deep(.p-tag.ot-status-requester-disagreed),
:global(.dark) :deep(.p-tag.ot-approval-rejected),
:global(.dark) :deep(.p-tag.ot-approval-requester-disagreed) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-cancelled),
:global(.dark) :deep(.p-tag.ot-approval-cancelled) {
  background: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-working-day) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-sunday) {
  background: rgba(249, 115, 22, 0.18) !important;
  color: #fdba74 !important;
  border-color: rgba(249, 115, 22, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-holiday) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-count-requested) {
  background: rgba(148, 163, 184, 0.14) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.35) !important;
}

:global(.dark) :deep(.p-tag.ot-count-approved) {
  background: rgba(14, 165, 233, 0.18) !important;
  color: #7dd3fc !important;
  border-color: rgba(14, 165, 233, 0.45) !important;
}

:global(.dark) .ot-mobile-no {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}

:global(.dark) .ot-adjust-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
}

@media (max-width: 1200px) {
  .ot-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .ot-summary-grid,
  .ot-confirm-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>