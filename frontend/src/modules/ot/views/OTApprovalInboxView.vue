<!-- frontend/src/modules/ot/views/OTApprovalInboxView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTApprovalInboxView.vue

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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

import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useOTRealtimeRefresh } from '@/modules/ot/otRealtimeRefresh'

import {
  decideOTRequest,
  exportOTApprovalInboxExcel,
  getOTApprovalInbox,
} from '@/modules/ot/ot.api'

import {
  getApprovedByDisplay,
  getApprovalDisplay,
  getApprovalTagClass,
  getEmployeeCount,
  getEmployeeDisplay,
  getEmployeePaidHoursLabel,
  getOTPermissions,
  getPaidHoursLabel,
  getRequesterDisplay,
  getTargetEmployees,
  normalizeOTRow,
} from '@/modules/ot/otDisplay'

const { t } = useI18n()
const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const SCROLL_LOAD_DISTANCE = 180
const AUTO_LOAD_GUARD_LIMIT = 6
const FILTER_STACK_WIDTH = 1380

const rows = ref([])
const totalRecords = ref(0)
const totalEmployees = ref(0)
const loadedPages = ref(new Set())
const loadingPages = ref(new Set())
const expandedRows = ref({})
const selectedRequestIds = ref([])

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const loadingMore = ref(false)
const exporting = ref(false)
const filtersPanelOpen = ref(false)

const filterBarRef = ref(null)
const approvalDataTableRef = ref(null)
const tableScrollShell = ref(null)
const filterActionsStacked = ref(false)

const filters = reactive({
  search: '',
  status: '',
  otDateFrom: '',
  otDateTo: '',
  sortBy: 'createdAt',
  sortOrder: -1,
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

let searchTimer = null
let queryVersion = 0
let filterResizeObserver = null
let tableScrollListenerElement = null
let tableAutoLoadRunning = false

function tr(key, fallback, params) {
  const value = t(key, params || {})

  if (!value || value === key) return fallback

  return value
}

const statusOptions = computed(() => [
  { label: tr('common.allStatus', 'All Status'), value: '' },
  { label: tr('ot.status.pending', 'Pending'), value: 'PENDING' },
  {
    label: tr(
      'ot.status.pendingRequesterConfirmation',
      'Waiting Requester Confirmation',
    ),
    value: 'PENDING_REQUESTER_CONFIRMATION',
  },
  { label: tr('ot.status.approved', 'Approved'), value: 'APPROVED' },
  { label: tr('ot.status.rejected', 'Rejected'), value: 'REJECTED' },
  {
    label: tr('ot.status.requesterDisagreed', 'Requester Disagreed'),
    value: 'REQUESTER_DISAGREED',
  },
  { label: tr('ot.status.cancelled', 'Cancelled'), value: 'CANCELLED' },
])

const totalInbox = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.length)
const hasAnyData = computed(() => rows.value.length > 0)
const hasMorePages = computed(() => loadedCount.value < totalInbox.value)

const summaryText = computed(() =>
  tr('common.loaded', 'Loaded {loaded} of {total}', {
    loaded: loadedCount.value,
    total: totalInbox.value,
  }),
)

const totalEmployeesLabel = computed(() =>
  tr('ot.summary.totalEmployees', '{count} employees', {
    count: totalEmployees.value,
  }),
)

const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

const activeAdvancedFilterCount = computed(() => {
  return [filters.status, filters.otDateFrom, filters.otDateTo].filter((value) =>
    String(value || '').trim(),
  ).length
})

const hasAdvancedFilters = computed(() => activeAdvancedFilterCount.value > 0)

const filterButtonLabel = computed(() => {
  const label = tr('common.filter', 'Filter')

  return activeAdvancedFilterCount.value
    ? `${label} (${activeAdvancedFilterCount.value})`
    : label
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

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.requests)) return payload.requests
  if (Array.isArray(payload?.otRequests)) return payload.otRequests
  if (Array.isArray(payload?.rows)) return payload.rows

  return []
}

function normalizeTotal(payload) {
  return Number(
    payload?.pagination?.total ||
      payload?.pagination?.totalRecords ||
      payload?.total ||
      payload?.totalRecords ||
      payload?.count ||
      0,
  )
}

function normalizeTotalEmployees(payload) {
  const candidates = [
    payload?.pagination?.totalEmployees,
    payload?.summary?.totalEmployees,
    payload?.totalEmployees,
  ]

  for (const candidate of candidates) {
    const total = Number(candidate)

    if (Number.isFinite(total) && total >= 0) {
      return Math.floor(total)
    }
  }

  return 0
}

function normalizeRow(row) {
  if (!row) return row

  const normalized = normalizeOTRow(row)

  return {
    ...normalized,
    id: String(
      normalized?.id ||
        normalized?._id ||
        normalized?.requestId ||
        normalized?.otRequestId ||
        normalized?.requestNo ||
        '',
    ).trim(),
  }
}

function rowIdOf(row) {
  return String(row?.id || row?._id || row?.requestId || row?.otRequestId || '').trim()
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

function displayRequester(row) {
  return getRequesterDisplay(row)
}

function displayApprovedBy(row) {
  return getApprovedByDisplay(row)
}

function displayApproval(row) {
  return getApprovalDisplay(row)
}

function displayApprovalTagClass(row) {
  return getApprovalTagClass(row, 'ot-approval')
}

function displayStaffCount(row) {
  return Number(
    row?.effectiveEmployeeCount ||
      row?.requestedEmployeeCount ||
      getEmployeeCount(row) ||
      0,
  )
}

function displayPaidTime(row) {
  return getPaidHoursLabel(row)
}

function displayEmployees(row) {
  return getTargetEmployees(row)
}

function employeeIdOf(employee) {
  return String(employee?.employeeId || employee?._id || employee?.id || '').trim()
}

function employeeCodeOf(employee) {
  return getEmployeeDisplay(employee).code
}

function employeeNameOf(employee) {
  return getEmployeeDisplay(employee).name
}

function employeePositionOf(employee) {
  const position = employee?.position || employee?.positionSnapshot || {}

  return String(
    employee?.positionName ||
      employee?.position ||
      employee?.positions ||
      employee?.positionTitle ||
      position?.name ||
      position?.positionName ||
      '-',
  ).trim() || '-'
}

function employeeLineOf(employee) {
  const line =
    employee?.line ||
    employee?.productionLine ||
    employee?.lineSnapshot ||
    employee?.productionLineSnapshot ||
    employee?.lineId ||
    employee?.productionLineId ||
    {}

  const name = String(
    employee?.lineName ||
      employee?.productionLineName ||
      line?.name ||
      line?.lineName ||
      line?.productionLineName ||
      '',
  ).trim()

  return name || '-'
}


function employeePaidTimeOf(employee, row) {
  return getEmployeePaidHoursLabel(employee, row)
}

function rowPermissions(row) {
  return getOTPermissions(row)
}

function canDecide(row) {
  const permissions = rowPermissions(row)

  return (
    permissions.canApprove === true ||
    permissions.canReject === true ||
    row?.approvalContext?.canDecide === true ||
    row?.canDecide === true
  )
}

function canApprove(row) {
  const permissions = rowPermissions(row)

  return (
    permissions.canApprove === true ||
    row?.approvalContext?.canDecide === true ||
    row?.canApprove === true ||
    row?.canDecide === true
  )
}

function canReject(row) {
  const permissions = rowPermissions(row)

  return (
    permissions.canReject === true ||
    row?.approvalContext?.canDecide === true ||
    row?.canReject === true ||
    row?.canDecide === true
  )
}

function canSelectForBulk(row) {
  if (!row) return false
  if (!canApprove(row)) return false

  return displayEmployees(row).some((employee) => employeeIdOf(employee))
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function setLoadingPage(page, value) {
  const next = new Set(loadingPages.value)

  if (value) {
    next.add(page)
  } else {
    next.delete(page)
  }

  loadingPages.value = next
}

function mergeRows(existingRows, incomingRows) {
  const existingIds = new Set(
    existingRows.map((row) => String(row?.id || '').trim()).filter(Boolean),
  )

  const nextRows = [...existingRows]

  for (const item of incomingRows) {
    const id = String(item?.id || '').trim()

    if (id && existingIds.has(id)) continue

    nextRows.push(item)

    if (id) existingIds.add(id)
  }

  return nextRows
}

async function fetchPage(page, { replace = false, silent = false, version = queryVersion } = {}) {
  if (!replace && loadedPages.value.has(page)) return
  if (!replace && loadingPages.value.has(page)) return

  setLoadingPage(page, true)

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTApprovalInbox(buildQuery(page))

    if (version !== queryVersion) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow).filter((row) => row?.id)
    const total = normalizeTotal(payload)
    const employeeTotal = normalizeTotalEmployees(payload)

    totalRecords.value = total
    totalEmployees.value = employeeTotal

    if (replace) {
      rows.value = items
      loadedPages.value = new Set([page])
      expandedRows.value = {}
      selectedRequestIds.value = []
    } else {
      rows.value = mergeRows(rows.value, items)

      const nextLoadedPages = new Set(loadedPages.value)
      nextLoadedPages.add(page)
      loadedPages.value = nextLoadedPages
    }

    bootstrapped.value = true
  } catch (error) {
    bootstrapped.value = true

    toast.add({
      severity: 'error',
      summary: tr('common.loadFailed', 'Load Failed'),
      detail: getApiErrorMessage(
        error,
        tr('ot.approval.loadFailed', 'Failed to load approval inbox'),
      ),
      life: 3500,
    })
  } finally {
    setLoadingPage(page, false)
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  queryVersion += 1

  loadedPages.value = new Set()
  loadingPages.value = new Set()

  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    totalEmployees.value = 0
    expandedRows.value = {}
    selectedRequestIds.value = []
    bootstrapped.value = false
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
    version: queryVersion,
  })

  await nextTick()
  bindTableScrollListener()

  if (tableScrollShell.value && !keepVisible) {
    tableScrollShell.value.scrollTop = 0
    tableScrollShell.value.scrollLeft = 0
  }

  await ensureTableScrollCanContinue()
}

function getNextPageToLoad() {
  const loaded = [...loadedPages.value]

  return loaded.length ? Math.max(...loaded) + 1 : 1
}

async function loadNextPage({ auto = false } = {}) {
  if (loadingMore.value) return false
  if (backgroundLoading.value) return false
  if (!hasMorePages.value) return false

  loadingMore.value = true

  try {
    await fetchPage(getNextPageToLoad(), {
      replace: false,
      silent: auto,
      version: queryVersion,
    })

    return true
  } finally {
    loadingMore.value = false
  }
}

function resolveTableScrollElement() {
  const root = approvalDataTableRef.value?.$el || approvalDataTableRef.value

  return (
    root?.querySelector?.('.p-datatable-table-container') ||
    root?.querySelector?.('.p-datatable-wrapper') ||
    null
  )
}

function bindTableScrollListener() {
  const element = resolveTableScrollElement()

  if (!element || tableScrollListenerElement === element) {
    if (element) tableScrollShell.value = element
    return
  }

  unbindTableScrollListener()

  tableScrollListenerElement = element
  tableScrollShell.value = element
  element.addEventListener('scroll', onTableScroll, { passive: true })
}

function unbindTableScrollListener() {
  if (tableScrollListenerElement) {
    tableScrollListenerElement.removeEventListener('scroll', onTableScroll)
  }

  tableScrollListenerElement = null
}

function shouldLoadMoreFromScrollElement(element) {
  if (!element || !hasMorePages.value) return false

  const scrollHeight = Number(element.scrollHeight || 0)
  const scrollTop = Number(element.scrollTop || 0)
  const clientHeight = Number(element.clientHeight || 0)

  if (!clientHeight) return false

  const hasVerticalScrollbar = scrollHeight > clientHeight + 8

  if (!hasVerticalScrollbar) return true

  return scrollHeight - scrollTop - clientHeight <= SCROLL_LOAD_DISTANCE
}

async function ensureTableScrollCanContinue() {
  if (tableAutoLoadRunning) return

  tableAutoLoadRunning = true

  try {
    await nextTick()
    bindTableScrollListener()

    const element = tableScrollShell.value || resolveTableScrollElement()
    if (!element) return

    let guard = 0

    while (
      guard < AUTO_LOAD_GUARD_LIMIT &&
      !loadingMore.value &&
      !backgroundLoading.value &&
      shouldLoadMoreFromScrollElement(element)
    ) {
      guard += 1

      const loaded = await loadNextPage({ auto: true })
      if (!loaded) break

      await nextTick()
    }
  } finally {
    tableAutoLoadRunning = false
  }
}

function onTableScroll(event) {
  const element = event?.target
  if (!element) return
  if (loadingMore.value || backgroundLoading.value) return

  if (shouldLoadMoreFromScrollElement(element)) {
    ensureTableScrollCanContinue()
  }
}

function updateFilterLayout() {
  const width = Number(filterBarRef.value?.getBoundingClientRect?.().width || 0)

  filterActionsStacked.value = width > 0 && width < FILTER_STACK_WIDTH
}

function setupFilterObserver() {
  updateFilterLayout()

  window.addEventListener('resize', updateFilterLayout)

  if (typeof ResizeObserver === 'undefined' || !filterBarRef.value) return

  filterResizeObserver = new ResizeObserver(() => {
    updateFilterLayout()
  })

  filterResizeObserver.observe(filterBarRef.value)
}

function cleanupFilterObserver() {
  window.removeEventListener('resize', updateFilterLayout)

  if (filterResizeObserver) {
    filterResizeObserver.disconnect()
    filterResizeObserver = null
  }
}

useOTRealtimeRefresh(
  () =>
    reloadFirstPage({
      keepVisible: true,
    }),
  {
    name: 'OTApprovalInboxView',
    debounceMs: 250,
  },
)

function runSearchSoon() {
  window.clearTimeout(searchTimer)

  searchTimer = window.setTimeout(() => {
    reloadFirstPage({ keepVisible: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function toggleFilters() {
  filtersPanelOpen.value = !filtersPanelOpen.value
}

function onSort(event) {
  filters.sortBy = event?.sortField || 'createdAt'
  filters.sortOrder = typeof event?.sortOrder === 'number' ? event.sortOrder : -1

  reloadFirstPage({ keepVisible: true })
}

async function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.otDateFrom = ''
  filters.otDateTo = ''
  filters.sortBy = 'createdAt'
  filters.sortOrder = -1

  await reloadFirstPage({ keepVisible: true })
}

function isRequestSelected(row) {
  const id = rowIdOf(row)

  return !!id && selectedRequestIds.value.includes(id)
}

function toggleRequestSelection(row, checked) {
  const id = rowIdOf(row)
  if (!id || !canSelectForBulk(row)) return

  const selected = new Set(selectedRequestIds.value)

  if (checked) {
    selected.add(id)
  } else {
    selected.delete(id)
  }

  selectedRequestIds.value = [...selected]
}

function toggleAllLoadedSelection(checked) {
  const selected = new Set(selectedRequestIds.value)

  for (const row of actionableLoadedRows.value) {
    const id = rowIdOf(row)

    if (!id) continue

    if (checked) {
      selected.add(id)
    } else {
      selected.delete(id)
    }
  }

  selectedRequestIds.value = [...selected]
}

function clearBulkSelection() {
  selectedRequestIds.value = []
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

  if (action === 'APPROVE' && !canApprove(row)) return
  if (action === 'REJECT' && !canReject(row)) return

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

function openBulkDialog() {
  if (!selectedBulkRows.value.length) return

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

async function handleExport() {
  exporting.value = true

  try {
    const res = await exportOTApprovalInboxExcel(buildExportQuery())

    const blob =
      res?.data instanceof Blob
        ? res.data
        : new Blob([res?.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

    downloadBlob(
      blob,
      getFilenameFromHeader(res, `ot-approval-inbox-${Date.now()}.xlsx`),
    )

    toast.add({
      severity: 'success',
      summary: tr('ot.approval.exported', 'Exported'),
      detail: tr(
        'ot.approval.exportedSuccess',
        'Approval inbox exported successfully',
      ),
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('ot.approval.exportFailed', 'Export Failed'),
      detail: getApiErrorMessage(
        error,
        tr('ot.approval.exportFailed', 'Failed to export approval inbox'),
      ),
      life: 3500,
    })
  } finally {
    exporting.value = false
  }
}

async function submitDecision() {
  const row = decisionDialog.row
  const id = rowIdOf(row)

  if (!id) return

  if (
    decisionDialog.action === 'REJECT' &&
    !String(decisionDialog.remark || '').trim()
  ) {
    toast.add({
      severity: 'warn',
      summary: tr('common.warning', 'Warning'),
      detail: tr(
        'ot.approval.rejectionRemarkRequired',
        'Please enter a rejection remark',
      ),
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
      summary: tr('ot.approval.decisionSuccess', 'Decision Saved'),
      detail: decisionIsApprove.value
        ? tr('ot.approval.approveSuccess', 'Request approved successfully')
        : tr('ot.approval.rejectSuccess', 'Request rejected successfully'),
      life: 2500,
    })

    resetDecisionDialog()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('ot.approval.decisionFailed', 'Decision Failed'),
      detail: getApiErrorMessage(
        error,
        tr('ot.approval.decisionFailed', 'Failed to save decision'),
      ),
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
        summary: tr('ot.approval.bulkCompleted', 'Bulk Approval Completed'),
        detail:
          failedCount > 0
            ? tr(
                'ot.approval.bulkPartial',
                `${successCount} approved, ${failedCount} failed`,
                {
                  success: successCount,
                  failed: failedCount,
                },
              )
            : tr('ot.approval.bulkSuccess', `${successCount} requests approved`, {
                count: successCount,
              }),
        life: 3500,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: tr('ot.approval.bulkFailed', 'Bulk Approval Failed'),
        detail: tr('ot.approval.bulkNoApproved', 'No request was approved'),
        life: 3500,
      })
    }

    closeBulkDialog()
    clearBulkSelection()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('ot.approval.bulkFailed', 'Bulk Approval Failed'),
      detail: getApiErrorMessage(
        error,
        tr('ot.approval.bulkFailed', 'Bulk approval failed'),
      ),
      life: 4000,
    })

    bulkDialog.loading = false
  }
}

onMounted(() => {
  setupFilterObserver()
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  unbindTableScrollListener()
  cleanupFilterObserver()
})
</script>

<template>
  <div class="ot-page-shell ot-approval-page">
    <section
      ref="filterBarRef"
      class="ot-filter-bar ot-approval-filter-bar"
      :class="{ 'is-filter-stacked': filterActionsStacked }"
    >
      <div class="ot-approval-filter-primary">
        <div class="ot-field ot-search-field">
          <label class="ot-field-label">
            {{ tr('common.search', 'Search') }}
          </label>

          <IconField class="ot-search-icon-field">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              :placeholder="tr('common.search', 'Search')"
              class="w-full ot-approval-search-input"
              inputmode="search"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              size="small"
              @input="onSearchInput"
            />
          </IconField>
        </div>

        <div class="ot-approval-filter-actions">
          <span class="ot-loaded-badge">
            {{ summaryText }}
          </span>

          <span
            class="ot-loaded-badge ot-total-employees-badge"
            :title="tr('ot.summary.totalEmployeesHint', 'Total employees in all requests matching the current filters')"
          >
            <i class="pi pi-users" aria-hidden="true" />
            {{ totalEmployeesLabel }}
          </span>

          <Button
            :label="filterButtonLabel"
            icon="pi pi-filter"
            severity="secondary"
            outlined
            size="small"
            :class="[
              'ot-approval-action-button',
              'ot-filter-toggle-button',
              { 'has-active-filters': hasAdvancedFilters },
            ]"
            :aria-expanded="filtersPanelOpen"
            @click="toggleFilters"
          />

          <Button
            :label="tr('ot.approval.exportExcel', 'Export Excel')"
            icon="pi pi-file-excel"
            severity="secondary"
            outlined
            size="small"
            class="ot-approval-action-button"
            :loading="exporting"
            @click="handleExport"
          />
        </div>
      </div>

      <Transition name="ot-filter-panel">
        <div
          v-show="filtersPanelOpen"
          class="ot-approval-filter-panel"
        >
          <div class="ot-field">
            <label class="ot-field-label">
              {{ tr('common.status', 'Status') }}
            </label>

            <Select
              v-model="filters.status"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              :placeholder="tr('common.status', 'Status')"
              class="w-full"
              size="small"
              @change="onFilterChange"
            />
          </div>

          <div class="ot-field">
            <HolidayDatePicker
              v-model="filters.otDateFrom"
              :label="tr('ot.requests.otDateFrom', 'OT Date From')"
              :placeholder="tr('ot.requests.otDateFrom', 'OT Date From')"
              @change="onFilterChange"
            />
          </div>

          <div class="ot-field">
            <HolidayDatePicker
              v-model="filters.otDateTo"
              :label="tr('ot.requests.otDateTo', 'OT Date To')"
              :placeholder="tr('ot.requests.otDateTo', 'OT Date To')"
              @change="onFilterChange"
            />
          </div>

          <div class="ot-approval-filter-panel-actions">
            <Button
              :label="tr('common.clear', 'Clear')"
              icon="pi pi-filter-slash"
              severity="secondary"
              outlined
              size="small"
              class="ot-approval-action-button"
              @click="clearFilters"
            />
          </div>
        </div>
      </Transition>
    </section>

    <section class="ot-table-card ot-approval-table-card">
      <div class="ot-table-toolbar ot-approval-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ tr('ot.approval.inboxTitle', 'OT Approval Inbox') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ tr('common.updating', 'Updating') }}
          </span>

          <Button
            v-if="selectedBulkCount > 0"
            :label="
              tr(
                'ot.approval.bulkApproveSelected',
                `Approve Selected (${selectedBulkCount})`,
                {
                  count: selectedBulkCount,
                },
              )
            "
            icon="pi pi-check"
            size="small"
            class="ot-approval-action-button ot-approve-button"
            @click="openBulkDialog"
          />

          <Button
            v-if="selectedBulkCount > 0"
            :label="tr('common.clear', 'Clear')"
            icon="pi pi-times"
            severity="secondary"
            outlined
            size="small"
            class="ot-approval-action-button"
            @click="clearBulkSelection"
          />
        </div>
      </div>

      <AppTableLoading
        v-if="firstLoading"
        :title="tr('ot.approval.loading', 'Loading approval inbox')"
        :message="tr('ot.approval.fetchingRecords', 'Fetching approval records')"
        :rows="8"
        :columns="9"
        icon="pi pi-inbox"
      />

      <div
        v-else
        class="ot-approval-table-shell"
      >
        <DataTable
          ref="approvalDataTableRef"
          v-model:expandedRows="expandedRows"
          :value="rows"
          data-key="id"
          lazy
          removable-sort
          row-hover
          scrollable
          scroll-height="calc(100vh - 260px)"
          :sort-field="filters.sortBy"
          :sort-order="filters.sortOrder"
          table-style="min-width: 73rem; table-layout: auto;"
          class="ot-approval-table ot-data-table ot-data-table-compact"
          @sort="onSort"
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
                {{ tr('common.noData', 'No Data') }}
              </div>

              <div class="ot-empty-text">
                {{ tr('ot.approval.noData', 'No approval requests found') }}
              </div>
            </div>
          </template>

          <Column
            header-class="ot-select-col-header"
            body-class="ot-select-col-body"
            style="width: 2.1rem; min-width: 2.1rem; max-width: 2.1rem"
          >
            <template #header>
              <Checkbox
                :model-value="allLoadedActionableSelected"
                binary
                :disabled="!actionableLoadedRows.length"
                @update:model-value="toggleAllLoadedSelection"
              />
            </template>

            <template #body="{ data }">
              <Checkbox
                v-if="data && canSelectForBulk(data)"
                :model-value="isRequestSelected(data)"
                binary
                @update:model-value="(checked) => toggleRequestSelection(data, checked)"
              />
            </template>
          </Column>

          <Column
            expander
            header-class="ot-expander-col-header"
            body-class="ot-expander-col-body"
            style="width: 2.1rem; min-width: 2.1rem; max-width: 2.1rem"
          />

          <Column
            field="requestNo"
            :header="tr('ot.requests.requestNo', 'Request No')"
            sortable
            style="width: 8.2rem; min-width: 8.2rem"
          >
            <template #body="{ data }">
              <span class="ot-request-no-text">
                {{ data.requestNo || data.otRequestNo || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.requester', 'Requester')"
            style="width: 10.2rem; min-width: 10.2rem"
          >
            <template #body="{ data }">
              <div class="requester-cell">
                <div class="ot-main-text">
                  {{ displayRequester(data).name }}
                </div>

                <div class="ot-sub-text">
                  {{ displayRequester(data).employeeNo }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            field="status"
            :header="tr('ot.requests.approvalStatus', 'Approval Status')"
            sortable
            style="width: 11rem; min-width: 11rem"
          >
            <template #body="{ data }">
              <div class="approval-status-cell">
                <Tag
                  :value="displayApproval(data).label"
                  :class="[
                    'ot-approval-rgb-tag',
                    'approval-display-tag',
                    displayApprovalTagClass(data),
                  ]"
                />
              </div>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.approvedBy', 'Approved By')"
            style="width: 9.4rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <div class="requester-cell">
                <div class="ot-main-text">
                  {{ displayApprovedBy(data).name }}
                </div>

                <div
                  v-if="displayApprovedBy(data).employeeNo"
                  class="ot-sub-text"
                >
                  {{ displayApprovedBy(data).employeeNo }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="tr('ot.approval.requestedStaff', 'Staff')"
            style="width: 5.8rem; min-width: 5.8rem"
          >
            <template #body="{ data }">
              <Tag
                :value="
                  tr('ot.requests.staffCount', `${displayStaffCount(data)} staff`, {
                    count: displayStaffCount(data),
                  })
                "
                class="ot-approval-rgb-tag ot-approval-tag-info"
              />
            </template>
          </Column>

          <Column
            field="otDate"
            :header="tr('ot.requests.otDate', 'OT Date')"
            sortable
            style="width: 6.5rem; min-width: 6.5rem"
          >
            <template #body="{ data }">
              <span class="ot-meta-text">
                {{ formatDateDMY(data.otDate) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.otTime', 'OT Time')"
            style="width: 6.2rem; min-width: 6.2rem"
          >
            <template #body="{ data }">
              <Tag
                :value="displayPaidTime(data)"
                class="ot-approval-rgb-tag ot-approval-tag-info"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="tr('common.createdAt', 'Created At')"
            sortable
            style="width: 8.6rem; min-width: 8.6rem"
          >
            <template #body="{ data }">
              <span class="ot-meta-text">
                {{ formatDateTimeDMY(data.createdAt) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('common.action', 'Action')"
            frozen
            align-frozen="right"
            header-class="ot-action-col-header"
            body-class="ot-action-col-body"
            style="width: 6.8rem; min-width: 6.8rem"
          >
            <template #body="{ data }">
              <div class="ot-row-actions">
                <Button
                  v-if="canApprove(data)"
                  :label="tr('ot.approval.approve', 'Approve')"
                  :aria-label="tr('ot.approval.approve', 'Approve')"
                  :title="tr('ot.approval.approve', 'Approve')"
                  icon="pi pi-check"
                  size="small"
                  class="ot-action-mini ot-action-icon-responsive ot-approve-button"
                  @click="openDecision(data, 'APPROVE')"
                />

                <Button
                  v-if="canReject(data)"
                  :label="tr('ot.approval.reject', 'Reject')"
                  :aria-label="tr('ot.approval.reject', 'Reject')"
                  :title="tr('ot.approval.reject', 'Reject')"
                  icon="pi pi-times"
                  severity="danger"
                  outlined
                  size="small"
                  class="ot-action-mini ot-action-icon-responsive"
                  @click="openDecision(data, 'REJECT')"
                />

                <span
                  v-if="!canDecide(data)"
                  class="ot-muted-action"
                >
                  {{ tr('ot.approval.notYourTurn', 'Not your turn') }}
                </span>
              </div>
            </template>
          </Column>

          <template #expansion="{ data }">
            <div class="ot-expanded-box">
              <div
                v-if="displayEmployees(data).length"
                class="ot-expanded-table-scroll"
              >
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ tr('common.no', 'No') }}</div>
                  <div>{{ tr('ot.requests.employeeId', 'Employee ID') }}</div>
                  <div>{{ tr('common.name', 'Name') }}</div>
                  <div>{{ tr('nav.positions', 'Position') }}</div>
                  <div>{{ tr('ot.requests.otTime', 'OT Time') }}</div>
                  <div>Line</div>
                </div>

                <div
                  v-for="(employee, index) in displayEmployees(data)"
                  :key="employeeIdOf(employee) || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">
                    {{ index + 1 }}
                  </div>

                  <div class="cell-center cell-code">
                    {{ employeeCodeOf(employee) }}
                  </div>

                  <div class="cell-center cell-strong cell-wrap">
                    {{ employeeNameOf(employee) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeePositionOf(employee) }}
                  </div>

                  <div class="cell-center">
                    <Tag
                      :value="employeePaidTimeOf(employee, data)"
                      class="ot-approval-rgb-tag ot-approval-tag-info"
                    />
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeLineOf(employee) }}
                  </div>
                </div>
              </div>

              <div
                v-else
                class="ot-expanded-empty"
              >
                {{ tr('ot.requests.noEmployeeData', 'No employee data') }}
              </div>
            </div>
          </template>
        </DataTable>
      </div>
    </section>

    <Dialog
      v-model:visible="decisionDialog.visible"
      modal
      :draggable="false"
      :closable="!decisionDialog.loading"
      :style="{ width: 'min(92vw, 34rem)' }"
      class="ot-decision-dialog"
      @hide="closeDecision"
    >
      <template #header>
        <div class="ot-dialog-header">
          <span
            class="ot-dialog-icon"
            :class="{ 'is-danger': decisionIsReject }"
          >
            <i :class="decisionIsApprove ? 'pi pi-check' : 'pi pi-times'" />
          </span>

          <div>
            <div class="ot-dialog-title">
              {{
                decisionIsApprove
                  ? tr('ot.approval.approveRequest', 'Approve OT Request')
                  : tr('ot.approval.rejectRequest', 'Reject OT Request')
              }}
            </div>

            <div class="ot-dialog-subtitle">
              {{ decisionDialog.row?.requestNo || '-' }}
            </div>
          </div>
        </div>
      </template>

      <div class="ot-dialog-body">
        <div class="ot-dialog-summary">
          <div>
            <span>{{ tr('ot.requests.requester', 'Requester') }}</span>
            <strong>{{ displayRequester(decisionDialog.row || {}).label }}</strong>
          </div>

          <div>
            <span>{{ tr('ot.approval.requestedStaff', 'Staff') }}</span>
            <strong>{{ displayStaffCount(decisionDialog.row || {}) }}</strong>
          </div>

          <div>
            <span>{{ tr('ot.requests.otTime', 'OT Time') }}</span>
            <strong>{{ displayPaidTime(decisionDialog.row || {}) }}</strong>
          </div>
        </div>

        <label class="ot-dialog-label">
          {{
            decisionIsReject
              ? tr('ot.approval.rejectRemark', 'Reject Remark')
              : tr('ot.approval.approveRemark', 'Approve Remark')
          }}
        </label>

        <Textarea
          v-model="decisionDialog.remark"
          rows="4"
          auto-resize
          class="w-full"
          :placeholder="
            decisionIsReject
              ? tr(
                  'ot.approval.rejectRemarkPlaceholder',
                  'Please enter reason for rejection',
                )
              : tr('ot.approval.approveRemarkPlaceholder', 'Optional remark')
          "
        />
      </div>

      <template #footer>
        <div class="ot-dialog-footer">
          <button
            type="button"
            class="ot-native-dialog-button is-cancel"
            :disabled="decisionDialog.loading"
            @click="closeDecision"
          >
            {{ tr('common.cancel', 'Cancel') }}
          </button>

          <button
            type="button"
            class="ot-native-dialog-button"
            :class="decisionIsApprove ? 'is-approve' : 'is-reject'"
            :disabled="decisionDialog.loading"
            :style="
              decisionIsApprove
                ? {
                    backgroundColor: 'rgb(34, 197, 94)',
                    borderColor: 'rgb(34, 197, 94)',
                    color: '#ffffff',
                  }
                : {
                    backgroundColor: 'rgb(239, 68, 68)',
                    borderColor: 'rgb(239, 68, 68)',
                    color: '#ffffff',
                  }
            "
            @click="submitDecision"
          >
            <i
              v-if="decisionDialog.loading"
              class="pi pi-spin pi-spinner"
            />
            <i
              v-else
              :class="decisionIsApprove ? 'pi pi-check' : 'pi pi-times'"
            />
            <span>
              {{
                decisionIsApprove
                  ? tr('ot.approval.approve', 'Approve')
                  : tr('ot.approval.reject', 'Reject')
              }}
            </span>
          </button>
        </div>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="bulkDialog.visible"
      modal
      :draggable="false"
      :closable="!bulkDialog.loading"
      :style="{ width: 'min(92vw, 34rem)' }"
      class="ot-decision-dialog"
      @hide="closeBulkDialog"
    >
      <template #header>
        <div class="ot-dialog-header">
          <span class="ot-dialog-icon">
            <i class="pi pi-check" />
          </span>

          <div>
            <div class="ot-dialog-title">
              {{ tr('ot.approval.bulkApprove', 'Bulk Approve') }}
            </div>

            <div class="ot-dialog-subtitle">
              {{
                tr(
                  'ot.approval.bulkSummary',
                  `${bulkRequestCount} requests · ${bulkEmployeeCount} employees`,
                  {
                    requests: bulkRequestCount,
                    employees: bulkEmployeeCount,
                  },
                )
              }}
            </div>
          </div>
        </div>
      </template>

      <div class="ot-dialog-body">
        <div class="ot-dialog-summary">
          <div>
            <span>{{ tr('ot.approval.requests', 'Requests') }}</span>
            <strong>{{ bulkRequestCount }}</strong>
          </div>

          <div>
            <span>{{ tr('ot.approval.employees', 'Employees') }}</span>
            <strong>{{ bulkEmployeeCount }}</strong>
          </div>
        </div>

        <label class="ot-dialog-label">
          {{ tr('ot.approval.approveRemark', 'Approve Remark') }}
        </label>

        <Textarea
          v-model="bulkDialog.remark"
          rows="4"
          auto-resize
          class="w-full"
          :placeholder="tr('ot.approval.approveRemarkPlaceholder', 'Optional remark')"
        />
      </div>

      <template #footer>
        <div class="ot-dialog-footer">
          <button
            type="button"
            class="ot-native-dialog-button is-cancel"
            :disabled="bulkDialog.loading"
            @click="closeBulkDialog"
          >
            {{ tr('common.cancel', 'Cancel') }}
          </button>

          <button
            type="button"
            class="ot-native-dialog-button is-approve"
            :disabled="bulkDialog.loading"
            :style="{
              backgroundColor: 'rgb(34, 197, 94)',
              borderColor: 'rgb(34, 197, 94)',
              color: '#ffffff',
            }"
            @click="submitBulkApproval"
          >
            <i
              v-if="bulkDialog.loading"
              class="pi pi-spin pi-spinner"
            />
            <i
              v-else
              class="pi pi-check"
            />
            <span>{{ tr('ot.approval.approve', 'Approve') }}</span>
          </button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.ot-approval-page {
  --ot-list-code-rgb: 37 99 235;
  --ot-list-green-rgb: 34 197 94;
  --ot-list-amber-rgb: 245 158 11;
  --ot-list-red-rgb: 239 68 68;
  --ot-list-blue-rgb: 59 130 246;
  --ot-list-muted-rgb: 100 116 139;

  --ot-approval-body-bg: var(--ot-surface);
  --ot-approval-head-bg: var(--ot-surface-2);
  --ot-approval-head-bg-solid: var(--ot-surface-3);
  --ot-approval-border: var(--ot-border);
  --ot-approval-text: var(--ot-text);
  --ot-approval-text-soft: var(--ot-text-soft);
  --ot-approval-text-muted: var(--ot-text-muted);
  --ot-approval-freeze-shadow: -10px 0 18px -16px rgb(15 23 42 / 0.7);

  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.9rem;
  overflow-x: hidden;
}

.ot-approval-page,
.ot-approval-page :deep(.p-component),
.ot-approval-page :deep(.p-inputtext),
.ot-approval-page :deep(.p-button),
.ot-approval-page :deep(.p-select),
.ot-approval-page :deep(.p-select-label) {
  font-family: var(--ot-font-main) !important;
}

/* Filter */

.ot-approval-filter-bar {
  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
  overflow: visible;
  border: 1px solid var(--ot-approval-border);
  border-radius: var(--ot-radius-lg);
  background:
    linear-gradient(135deg, rgba(129, 166, 198, 0.12), transparent 34%),
    var(--ot-approval-body-bg);
  box-shadow: var(--ot-shadow-sm);
  padding: 0.85rem;
}

.ot-approval-filter-primary {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(260px, 1fr) minmax(0, auto);
  gap: 0.75rem;
  align-items: end;
}

.ot-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

.ot-field-label {
  color: var(--ot-approval-text-soft);
  font-size: 0.74rem;
  font-weight: 700;
}

.ot-search-icon-field {
  width: 100%;
  min-width: 0;
}

.ot-search-field :deep(.ot-approval-search-input.p-inputtext) {
  min-height: 2.1rem;
  font-size: 0.84rem;
}

.ot-approval-filter-actions {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-approval-filter-panel {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns:
    minmax(150px, 0.75fr)
    minmax(170px, 0.85fr)
    minmax(170px, 0.85fr)
    minmax(0, auto);
  gap: 0.75rem;
  align-items: end;
  border-top: 1px solid var(--ot-approval-border);
  padding-top: 0.72rem;
}

.ot-approval-filter-panel-actions {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
}

.ot-filter-panel-enter-active,
.ot-filter-panel-leave-active {
  overflow: hidden;
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    max-height 0.16s ease;
}

.ot-filter-panel-enter-from,
.ot-filter-panel-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.ot-filter-panel-enter-to,
.ot-filter-panel-leave-from {
  max-height: 8rem;
  opacity: 1;
  transform: translateY(0);
}

.ot-approval-action-button {
  max-width: 100%;
  white-space: nowrap;
}

.ot-approval-action-button :deep(.p-button-label) {
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-action-button :deep(.p-button-icon) {
  flex: 0 0 auto;
  font-size: 0.76rem;
}

.ot-filter-toggle-button.has-active-filters {
  border-color: color-mix(in srgb, var(--ot-info) 35%, transparent) !important;
  background: var(--ot-info-soft) !important;
  color: var(--ot-info) !important;
}

.ot-total-employees-badge {
  border-color: color-mix(in srgb, var(--ot-info) 35%, var(--ot-approval-border));
  background: var(--ot-info-soft);
  color: var(--ot-info);
}

.ot-total-employees-badge .pi {
  font-size: 0.78rem;
}

.ot-loaded-badge {
  display: inline-flex;
  min-height: 1.9rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--ot-approval-border);
  border-radius: 999px;
  background: var(--ot-surface-2);
  color: var(--ot-approval-text-soft);
  padding: 0.28rem 0.62rem;
  font-size: 0.74rem;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
}

/* Table card */

.ot-approval-table-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ot-approval-border);
  border-radius: var(--ot-radius-lg);
  background: var(--ot-approval-body-bg);
  box-shadow: var(--ot-shadow-sm);
}

.ot-approval-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-approval-border);
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.07), transparent 32%),
    var(--ot-approval-body-bg);
  padding: 0.82rem 1rem;
}

.ot-table-title {
  margin: 0;
  color: var(--ot-approval-text);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
}

.ot-table-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-approval-table-shell {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

/* Main table */

:deep(.ot-approval-table.p-datatable) {
  max-width: 100% !important;
  min-width: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-wrapper),
:deep(.ot-approval-table.p-datatable .p-datatable-table-container) {
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: auto !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

:deep(.ot-approval-table.p-datatable .p-datatable-table) {
  min-width: 64rem !important;
  table-layout: auto !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-thead) {
  position: sticky !important;
  top: 0 !important;
  z-index: 80 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-thead > tr > th) {
  position: sticky !important;
  top: 0 !important;
  z-index: 82 !important;
  border-color: var(--ot-approval-border) !important;
  background: var(--ot-approval-head-bg-solid) !important;
  background-color: var(--ot-approval-head-bg-solid) !important;
  background-image: none !important;
  color: var(--ot-approval-text-soft) !important;
  padding: 0.54rem 0.6rem !important;
  font-size: 0.74rem !important;
  font-weight: 800 !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  opacity: 1 !important;
  box-shadow:
    0 1px 0 var(--ot-approval-border),
    0 8px 14px rgb(15 23 42 / 0.045);
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr > td) {
  height: 60px !important;
  border-color: var(--ot-approval-border) !important;
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
  padding: 0.4rem 0.6rem !important;
  color: var(--ot-approval-text) !important;
  font-size: 0.78rem !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  opacity: 1 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr:hover > td) {
  background: color-mix(in srgb, var(--ot-approval-body-bg) 92%, var(--ot-sky) 8%) !important;
  background-color: color-mix(in srgb, var(--ot-approval-body-bg) 92%, var(--ot-sky) 8%) !important;
  opacity: 1 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr.p-datatable-row-expansion > td) {
  height: auto !important;
  border-color: transparent !important;
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  padding: 0.42rem 0.6rem 0.65rem !important;
}

/* Small checkbox and expander columns */

:deep(.ot-approval-table.p-datatable .ot-select-col-header),
:deep(.ot-approval-table.p-datatable .ot-select-col-body),
:deep(.ot-approval-table.p-datatable .ot-expander-col-header),
:deep(.ot-approval-table.p-datatable .ot-expander-col-body) {
  width: 2.1rem !important;
  min-width: 2.1rem !important;
  max-width: 2.1rem !important;
  padding-inline: 0.16rem !important;
}

:deep(.ot-approval-table.p-datatable .p-checkbox) {
  display: inline-flex !important;
  width: 1rem !important;
  height: 1rem !important;
  margin-inline: auto !important;
}

:deep(.ot-approval-table.p-datatable .p-checkbox-box) {
  width: 1rem !important;
  height: 1rem !important;
  border-radius: 0.28rem !important;
}

:deep(.ot-approval-table.p-datatable .p-row-toggler) {
  display: inline-flex !important;
  width: 1.45rem !important;
  height: 1.45rem !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 999px !important;
  color: var(--ot-info) !important;
}

:deep(.ot-approval-table.p-datatable .p-row-toggler:hover) {
  background: var(--ot-info-soft) !important;
}

/* Frozen action column */

:deep(.ot-approval-table.p-datatable .p-datatable-frozen-column),
:deep(.ot-approval-table.p-datatable .ot-action-col-body) {
  position: sticky !important;
  right: 0 !important;
  z-index: 70 !important;
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
  opacity: 1 !important;
  isolation: isolate;
  box-shadow: var(--ot-approval-freeze-shadow);
}

:deep(.ot-approval-table.p-datatable .p-datatable-thead > tr > th.p-datatable-frozen-column),
:deep(.ot-approval-table.p-datatable .ot-action-col-header) {
  position: sticky !important;
  right: 0 !important;
  z-index: 95 !important;
  background: var(--ot-approval-head-bg-solid) !important;
  background-color: var(--ot-approval-head-bg-solid) !important;
  background-image: none !important;
  opacity: 1 !important;
  isolation: isolate;
  box-shadow: var(--ot-approval-freeze-shadow);
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr:hover .p-datatable-frozen-column),
:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr:hover .ot-action-col-body),
:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr.p-row-expanded .p-datatable-frozen-column),
:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr.p-row-expanded .ot-action-col-body) {
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
  opacity: 1 !important;
}

/* Header/cell alignment */

:deep(.ot-approval-table.p-datatable .p-datatable-column-header-content),
:deep(.ot-approval-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-column-title),
:deep(.ot-approval-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-approval-table.p-datatable .p-sortable-column-icon),
:deep(.ot-approval-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

/* Text */

.ot-request-no-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ot-info);
  font-size: 0.8rem;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.requester-cell,
.approval-status-cell {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  text-align: center;
}

.ot-main-text {
  max-width: 9.2rem;
  overflow: hidden;
  color: var(--ot-approval-text);
  font-size: 0.8rem;
  font-weight: 660;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-sub-text {
  max-width: 8.8rem;
  overflow: hidden;
  color: var(--ot-approval-text-muted);
  font-size: 0.7rem;
  font-weight: 520;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-meta-text {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--ot-approval-text-soft);
  font-size: 0.76rem;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Tags / actions */

.ot-approval-rgb-tag {
  --ot-approval-tag-rgb: var(--ot-list-muted-rgb);

  display: inline-flex !important;
  min-height: 1.36rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--ot-approval-tag-rgb) / 0.28) !important;
  border-radius: 999px !important;
  background: rgb(var(--ot-approval-tag-rgb) / 0.11) !important;
  color: rgb(var(--ot-approval-tag-rgb)) !important;
  padding: 0.1rem 0.46rem !important;
  font-size: 0.68rem !important;
  font-weight: 730 !important;
  line-height: 1 !important;
  text-align: center !important;
  white-space: nowrap !important;
}

.approval-display-tag {
  max-width: 12rem;
}

.ot-approval-tag-approved {
  --ot-approval-tag-rgb: var(--ot-list-green-rgb);
}

.ot-approval-tag-rejected {
  --ot-approval-tag-rgb: var(--ot-list-red-rgb);
}

.ot-approval-tag-pending {
  --ot-approval-tag-rgb: var(--ot-list-amber-rgb);
}

.ot-approval-tag-info {
  --ot-approval-tag-rgb: var(--ot-list-blue-rgb);
}

.ot-approval-tag-muted {
  --ot-approval-tag-rgb: var(--ot-list-muted-rgb);
}

.ot-row-actions {
  display: inline-grid;
  width: 100%;
  max-width: 100%;
  grid-template-columns: 1fr;
  align-items: center;
  justify-content: center;
  gap: 0.22rem;
}

.ot-action-mini {
  width: 100%;
  min-height: 1.66rem;
  padding-inline: 0.45rem;
  white-space: nowrap;
}

.ot-action-mini :deep(.p-button-label) {
  font-size: 0.7rem;
  font-weight: 620;
}

.ot-action-mini :deep(.p-button-icon) {
  font-size: 0.7rem;
}

.ot-approve-button {
  border-color: var(--ot-success) !important;
  background: var(--ot-success) !important;
  color: #ffffff !important;
}

.ot-approve-button:hover {
  border-color: #15803d !important;
  background: #15803d !important;
  color: #ffffff !important;
}

.ot-muted-action {
  color: var(--ot-approval-text-muted);
  font-size: 0.7rem;
  font-weight: 620;
  white-space: nowrap;
}

/* Expanded child table */

.ot-expanded-box {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--ot-approval-border);
  border-radius: 0.9rem;
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
  padding: 0.55rem;
}

.ot-expanded-table-scroll {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  max-height: 18rem;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--ot-approval-border);
  border-radius: 0.78rem;
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    minmax(2.5rem, 0.34fr)
    minmax(5.8rem, 0.72fr)
    minmax(9rem, 1.15fr)
    minmax(8rem, 1fr)
    minmax(5.8rem, 0.72fr)
    minmax(7rem, 0.9fr);
  min-width: 0;
  min-height: 2.35rem;
  align-items: stretch;
  border-bottom: 1px solid var(--ot-approval-border);
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
}

.ot-expanded-grid-row:last-child {
  border-bottom: 0;
}

.ot-expanded-grid-row > div {
  display: flex;
  min-width: 0;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--ot-approval-border);
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  background-image: none !important;
  padding: 0.4rem 0.48rem;
  color: var(--ot-approval-text-soft);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.24;
  text-align: center;
  background-clip: border-box !important;
}

.ot-expanded-grid-row > div:last-child {
  border-right: 0;
}

/* Solid child sticky header */

.ot-expanded-grid-row.is-head {
  position: sticky !important;
  top: 0 !important;
  z-index: 60 !important;
  min-height: 2.15rem;
  background: var(--ot-approval-head-bg-solid) !important;
  background-color: var(--ot-approval-head-bg-solid) !important;
  background-image: none !important;
  opacity: 1 !important;
  box-shadow:
    0 1px 0 var(--ot-approval-border),
    0 8px 14px rgb(15 23 42 / 0.08);
}

.ot-expanded-grid-row.is-head > div {
  position: relative;
  z-index: 61 !important;
  border-right: 1px solid var(--ot-approval-border);
  background: var(--ot-approval-head-bg-solid) !important;
  background-color: var(--ot-approval-head-bg-solid) !important;
  background-image: none !important;
  color: var(--ot-approval-text-soft);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  opacity: 1 !important;
  background-clip: border-box !important;
}

.ot-expanded-grid-row.is-head > div:last-child {
  border-right: 0;
}

.cell-center {
  text-align: center;
}

.cell-code {
  color: var(--ot-info) !important;
  font-weight: 700 !important;
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  color: var(--ot-approval-text) !important;
  font-family: var(--ot-font-km) !important;
  font-weight: 650 !important;
}

.cell-wrap {
  overflow-wrap: anywhere;
  white-space: normal;
}

.ot-expanded-empty {
  border: 1px dashed var(--ot-approval-border);
  border-radius: 0.85rem;
  background: var(--ot-approval-body-bg) !important;
  background-color: var(--ot-approval-body-bg) !important;
  color: var(--ot-approval-text-muted);
  padding: 0.85rem;
  font-size: 0.8rem;
  font-weight: 520;
  text-align: center;
}

/* Empty state */

.ot-empty-state {
  display: flex;
  min-height: 14rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 2rem;
  color: var(--ot-approval-text-muted);
}

.ot-empty-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 999px;
  background: var(--ot-info-soft);
  color: var(--ot-info);
  font-size: 1.25rem;
}

.ot-empty-title {
  color: var(--ot-approval-text);
  font-size: 0.95rem;
  font-weight: 800;
}

.ot-empty-text {
  max-width: 26rem;
  font-size: 0.82rem;
  line-height: 1.4;
  text-align: center;
}

/* Dialog */

.ot-dialog-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ot-dialog-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--ot-success) 35%, transparent);
  border-radius: 999px;
  background: var(--ot-success-soft);
  color: var(--ot-success);
  font-size: 0.95rem;
}

.ot-dialog-icon.is-danger {
  border-color: color-mix(in srgb, var(--ot-danger) 35%, transparent);
  background: var(--ot-danger-soft);
  color: var(--ot-danger);
}

.ot-dialog-title {
  color: var(--ot-approval-text);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
}

.ot-dialog-subtitle {
  margin-top: 0.1rem;
  color: var(--ot-approval-text-muted);
  font-size: 0.76rem;
  font-weight: 650;
}

.ot-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.ot-dialog-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.ot-dialog-summary > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.18rem;
  border: 1px solid var(--ot-approval-border);
  border-radius: 0.85rem;
  background: var(--ot-surface-2);
  padding: 0.64rem;
}

.ot-dialog-summary span {
  color: var(--ot-approval-text-muted);
  font-size: 0.68rem;
  font-weight: 760;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.ot-dialog-summary strong {
  overflow-wrap: anywhere;
  color: var(--ot-approval-text);
  font-size: 0.8rem;
  font-weight: 760;
}

.ot-dialog-label {
  color: var(--ot-approval-text-soft);
  font-size: 0.76rem;
  font-weight: 750;
}

.ot-dialog-footer {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: 0.55rem;
}

.ot-native-dialog-button {
  appearance: none;
  display: inline-flex;
  min-width: 6.6rem;
  min-height: 2.35rem;
  align-items: center;
  justify-content: center;
  gap: 0.38rem;
  border-radius: 0.75rem;
  border: 1px solid transparent;
  padding: 0.52rem 0.9rem;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease,
    opacity 0.14s ease;
}

.ot-native-dialog-button i {
  font-size: 0.8rem;
}

.ot-native-dialog-button.is-cancel {
  min-width: 6.2rem;
  border-color: var(--ot-approval-border);
  background: var(--ot-approval-body-bg);
  color: var(--ot-approval-text-soft);
}

.ot-native-dialog-button.is-cancel:hover:not(:disabled) {
  background: var(--ot-surface-2);
  color: var(--ot-approval-text);
}

.ot-native-dialog-button.is-approve {
  border-color: var(--ot-success);
  background: var(--ot-success);
  color: #ffffff;
}

.ot-native-dialog-button.is-approve:hover:not(:disabled) {
  border-color: #15803d !important;
  background: #15803d !important;
  color: #ffffff !important;
}

.ot-native-dialog-button.is-reject {
  border-color: var(--ot-danger);
  background: var(--ot-danger);
  color: #ffffff;
}

.ot-native-dialog-button.is-reject:hover:not(:disabled) {
  border-color: #dc2626 !important;
  background: #dc2626 !important;
  color: #ffffff !important;
}

.ot-native-dialog-button:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

/* Dark mode */

:global(.dark) .ot-approval-page {
  --ot-list-muted-rgb: 203 213 225;

  --ot-approval-body-bg: var(--ot-surface);
  --ot-approval-head-bg: var(--ot-surface-2);
  --ot-approval-head-bg-solid: var(--ot-surface-3);
  --ot-approval-border: var(--ot-border);
  --ot-approval-text: var(--ot-text);
  --ot-approval-text-soft: var(--ot-text-soft);
  --ot-approval-text-muted: var(--ot-text-muted);
  --ot-approval-freeze-shadow: -10px 0 18px -16px rgb(0 0 0 / 0.95);
}

:global(.dark) .ot-approval-rgb-tag {
  border-color: rgb(var(--ot-approval-tag-rgb) / 0.42) !important;
  background: rgb(var(--ot-approval-tag-rgb) / 0.18) !important;
}

/* Responsive */

@media (max-width: 1100px) {
  .ot-approval-filter-primary {
    grid-template-columns: 1fr;
  }

  .ot-approval-filter-actions {
    justify-content: flex-start;
  }

  .ot-approval-filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-approval-filter-panel-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .ot-approval-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-table-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .ot-approval-page {
    gap: 0.55rem;
  }

  .ot-approval-filter-bar {
    gap: 0.5rem;
    border-radius: var(--ot-radius-md);
    padding: 0.55rem;
  }

  .ot-approval-filter-primary {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .ot-search-field .ot-field-label {
    display: none;
  }

  .ot-search-field :deep(.ot-approval-search-input.p-inputtext) {
    min-height: 2.25rem;
    font-size: 16px !important;
    line-height: 1.2;
  }

  .ot-approval-filter-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    justify-content: stretch;
  }

  .ot-approval-filter-actions > * {
    min-width: 0;
  }

  .ot-loaded-badge {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 1.55rem;
    padding: 0.18rem 0.45rem;
    font-size: 0.68rem;
  }

  .ot-approval-action-button {
    width: 100%;
    min-height: 2rem;
    justify-content: center;
  }

  .ot-approval-action-button :deep(.p-button-label) {
    font-size: 0.72rem;
  }

  .ot-approval-filter-panel {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding-top: 0.55rem;
  }

  .ot-approval-filter-panel-actions {
    justify-content: stretch;
  }

  .ot-filter-panel-enter-to,
  .ot-filter-panel-leave-from {
    max-height: 16rem;
  }

  .ot-approval-table-card {
    border-radius: var(--ot-radius-md);
  }

  .ot-approval-table-toolbar {
    gap: 0.45rem;
    padding: 0.55rem 0.65rem;
  }

  .ot-table-title {
    font-size: 0.88rem;
  }

  .ot-table-actions {
    width: 100%;
    gap: 0.35rem;
  }

  .ot-dialog-summary {
    grid-template-columns: 1fr;
  }

  :deep(.ot-approval-table.p-datatable .p-datatable-table) {
    min-width: 54rem !important;
  }

  :deep(.ot-approval-table.p-datatable .p-datatable-thead > tr > th) {
    padding: 0.34rem 0.38rem !important;
    font-size: 0.66rem !important;
  }

  :deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr > td) {
    height: 44px !important;
    padding: 0.26rem 0.38rem !important;
    font-size: 0.7rem !important;
  }

  :deep(.ot-approval-table.p-datatable .ot-select-col-header),
  :deep(.ot-approval-table.p-datatable .ot-select-col-body),
  :deep(.ot-approval-table.p-datatable .ot-expander-col-header),
  :deep(.ot-approval-table.p-datatable .ot-expander-col-body) {
    width: 1.9rem !important;
    min-width: 1.9rem !important;
    max-width: 1.9rem !important;
    padding-inline: 0.12rem !important;
  }

  :deep(.ot-approval-table.p-datatable .p-row-toggler) {
    width: 1.35rem !important;
    height: 1.35rem !important;
  }

  .ot-request-no-text {
    font-size: 0.7rem;
  }

  .ot-main-text {
    max-width: 9.2rem;
    overflow: hidden;
    color: var(--ot-approval-text);
    font-family: var(--ot-font-km) !important;
    font-size: 0.8rem;
    font-weight: 660;
    line-height: 1.25;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ot-sub-text {
    max-width: 6.8rem;
    font-size: 0.6rem;
  }

  .ot-meta-text {
    font-size: 0.66rem;
  }

  .ot-approval-rgb-tag {
    min-height: 1.14rem;
    padding: 0.07rem 0.32rem !important;
    font-size: 0.6rem !important;
  }

  :deep(.ot-approval-table.p-datatable .ot-action-col-header),
  :deep(.ot-approval-table.p-datatable .ot-action-col-body) {
    width: 2.45rem !important;
    min-width: 2.45rem !important;
    max-width: 2.45rem !important;
    padding: 0.18rem 0.12rem !important;
  }

  :deep(.ot-approval-table.p-datatable .ot-action-col-header .p-column-title),
  :deep(.ot-approval-table.p-datatable .ot-action-col-header .p-datatable-column-title) {
    display: none !important;
  }

  .ot-row-actions {
    display: inline-grid;
    grid-template-columns: 1fr;
    gap: 0.18rem;
  }

  .ot-action-icon-responsive {
    width: 1.62rem !important;
    min-width: 1.62rem !important;
    height: 1.62rem !important;
    min-height: 1.62rem !important;
    border-radius: 999px !important;
    padding: 0 !important;
  }

  .ot-action-icon-responsive :deep(.p-button-label) {
    display: none !important;
  }

  .ot-action-icon-responsive :deep(.p-button-icon) {
    margin: 0 !important;
    font-size: 0.7rem !important;
  }

  .ot-muted-action {
    max-width: 2.2rem;
    overflow: hidden;
    font-size: 0.56rem;
    line-height: 1.05;
    text-align: center;
    white-space: normal;
  }

  .ot-expanded-box {
    border-radius: 0.72rem;
    padding: 0.38rem;
  }

  .ot-expanded-table-scroll {
    width: 100%;
    min-width: 0;
    max-height: 15rem;
  }

  .ot-expanded-grid-row {
    min-width: 38rem;
    min-height: 2.05rem;
    grid-template-columns:
      2.6rem
      5.8rem
      minmax(7.5rem, 1.05fr)
      minmax(6.8rem, 0.95fr)
      5.6rem
      minmax(6.4rem, 0.85fr);
  }

  .ot-expanded-grid-row > div {
    padding: 0.3rem 0.36rem;
    font-size: 0.66rem;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.58rem;
  }
}

@media (max-width: 640px) {
  .ot-dialog-footer {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .ot-native-dialog-button {
    width: 100%;
  }
}
</style>