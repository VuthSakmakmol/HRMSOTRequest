<!-- frontend/src/modules/ot/views/OTRequestListView.vue -->
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'

import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useOTRealtimeRefresh } from '@/modules/ot/otRealtimeRefresh'

import {
  cancelOTRequest,
  deleteOTRequest,
  exportOTRequestsExcel,
  getOTRequests,
} from '@/modules/ot/ot.api'

import {
  getApprovedByDisplay,
  getApprovalDisplay,
  getApprovalTagClass,
  getEmployeeCount,
  getEmployeeDisplay,
  getEmployeePaidHoursLabel,
  getPaidHoursLabel,
  getRequesterDisplay,
  getTargetEmployees,
  normalizeOTRow,
} from '@/modules/ot/otDisplay'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const { t, te } = useI18n()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250
const SCROLL_LOAD_DISTANCE = 180
const AUTO_LOAD_GUARD_LIMIT = 6
const FILTER_STACK_WIDTH = 1460

const rows = ref([])
const totalRecords = ref(0)
const totalEmployees = ref(0)
const loadedPages = ref(new Set())
const loadingPages = ref(new Set())
const expandedRows = ref({})

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const loadingMore = ref(false)
const exporting = ref(false)
const cancellingIds = ref(new Set())
const deletingIds = ref(new Set())
const cancelConfirmVisible = ref(false)
const deleteConfirmVisible = ref(false)
const cancelTargetRow = ref(null)
const deleteTargetRow = ref(null)
const filtersPanelOpen = ref(false)
const activeDatePicker = ref('')

const requestDataTableRef = ref(null)
const tableScrollShell = ref(null)
const filterBarRef = ref(null)
const filterActionsStacked = ref(false)

const otDateFromPickerRef = ref(null)
const otDateToPickerRef = ref(null)

const filters = reactive({
  search: '',
  status: '',
  otDateFrom: '',
  otDateTo: '',
  sortBy: 'createdAt',
  sortOrder: -1,
})

let searchTimer = null
let queryVersion = 0
let filterResizeObserver = null
let tableScrollListenerElement = null
let tableAutoLoadRunning = false

const isRootAdminUser = computed(() => {
  const roleCodes = Array.isArray(auth.user?.roleCodes)
    ? auth.user.roleCodes.map((code) => String(code || '').trim().toUpperCase()).filter(Boolean)
    : []

  return (
    auth.isRootAdmin === true ||
    auth.user?.isRootAdmin === true ||
    roleCodes.includes('ROOT_ADMIN')
  )
})

const canCreate = computed(() => auth.hasPermission('OT_REQUEST_CREATE'))
const canExport = computed(() => auth.hasPermission('OT_REQUEST_VIEW'))
const canDeleteAnyRequest = computed(() => {
  return isRootAdminUser.value || auth.hasPermission('OT_REQUEST_DELETE')
})

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.length)
const hasAnyData = computed(() => rows.value.length > 0)
const hasMorePages = computed(() => loadedCount.value < totalRequests.value)

const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

const cancelTargetRequestNo = computed(() => {
  const row = cancelTargetRow.value || {}

  return String(row.requestNo || row.otRequestNo || row.id || '').trim()
})

const cancelTargetStatusLabel = computed(() => {
  const row = cancelTargetRow.value || {}
  const approval = displayApproval(row)

  return String(approval?.label || row.statusLabel || row.status || '-').trim()
})

const cancelTargetEmployeeCount = computed(() => {
  return displayStaffCount(cancelTargetRow.value || {})
})

const cancelTargetIsLoading = computed(() => {
  return cancelTargetRow.value ? isCancellingRow(cancelTargetRow.value) : false
})

const deleteTargetRequestNo = computed(() => {
  const row = deleteTargetRow.value || {}

  return String(row.requestNo || row.otRequestNo || row.id || '').trim()
})

const deleteTargetStatusLabel = computed(() => {
  const row = deleteTargetRow.value || {}
  const approval = displayApproval(row)

  return String(approval?.label || row.statusLabel || row.status || '-').trim()
})

const deleteTargetEmployeeCount = computed(() => {
  return displayStaffCount(deleteTargetRow.value || {})
})

const deleteTargetIsLoading = computed(() => {
  return deleteTargetRow.value ? isDeletingRow(deleteTargetRow.value) : false
})

function tr(key, fallback, params) {
  if (te(key)) return t(key, params || {})

  return fallback
}

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

const loadedLabel = computed(() =>
  tr('common.loaded', 'Loaded {loaded} of {total}', {
    loaded: loadedCount.value,
    total: totalRequests.value,
  }),
)

const totalEmployeesLabel = computed(() =>
  tr('ot.summary.totalEmployees', '{count} employees', {
    count: totalEmployees.value,
  }),
)

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
  return getApprovalTagClass(row, 'ot-request')
}

function displayStaffCount(row) {
  return Number(row?.requestedEmployeeCount || getEmployeeCount(row) || 0)
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
    scope: 'mine',
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
    scope: 'mine',
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
    const res = await getOTRequests(buildQuery(page))

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
      detail: getApiErrorMessage(error, tr('ot.requests.loadFailed', 'Failed to load OT requests')),
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
  const root = requestDataTableRef.value?.$el || requestDataTableRef.value

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
    name: 'OTRequestListView',
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

function setActiveDatePicker(name) {
  activeDatePicker.value = name
}

function onDatePickerShow(name) {
  activeDatePicker.value = name

  if (name === 'from') {
    otDateToPickerRef.value?.hide?.()
  }

  if (name === 'to') {
    otDateFromPickerRef.value?.hide?.()
  }
}

function onDatePickerHide(name) {
  if (activeDatePicker.value === name) {
    activeDatePicker.value = ''
  }
}

async function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.otDateFrom = ''
  filters.otDateTo = ''
  filters.sortBy = 'createdAt'
  filters.sortOrder = -1
  activeDatePicker.value = ''

  await reloadFirstPage({ keepVisible: true })
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
    const res = await exportOTRequestsExcel(buildExportQuery())

    const blob =
      res?.data instanceof Blob
        ? res.data
        : new Blob([res?.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

    downloadBlob(blob, getFilenameFromHeader(res, `ot-requests-${Date.now()}.xlsx`))

    toast.add({
      severity: 'success',
      summary: tr('ot.requests.exported', 'Exported'),
      detail: tr('ot.requests.exportedSuccess', 'OT requests exported successfully'),
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('ot.requests.exportFailed', 'Export Failed'),
      detail: getApiErrorMessage(error, tr('ot.requests.exportFailed', 'Failed to export OT requests')),
      life: 3500,
    })
  } finally {
    exporting.value = false
  }
}

function rowIdOf(row = {}) {
  return String(row?.id || row?._id || row?.requestId || row?.otRequestId || '').trim()
}

function toBooleanOrNull(value) {
  if (value === true) return true
  if (value === false) return false
  if (value === 1) return true
  if (value === 0) return false

  const normalized = String(value ?? '').trim().toLowerCase()

  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false

  return null
}

function readRowAction(row = {}, key, aliases = []) {
  const names = [key, ...aliases]

  const containers = [
    row,
    row?.permissions,
    row?.permission,
    row?.actions,
    row?.availableActions,
    row?.allowedActions,
    row?.actionPermissions,
    row?.uiPermissions,
    row?.ui,
  ]

  for (const container of containers) {
    if (!container) continue

    if (Array.isArray(container)) {
      const normalizedActions = container.map((item) =>
        String(item || '').trim().toLowerCase(),
      )

      for (const name of names) {
        const normalizedName = String(name || '').trim().toLowerCase()
        const simpleName = normalizedName.replace(/^can/, '')

        if (
          normalizedActions.includes(normalizedName) ||
          normalizedActions.includes(simpleName)
        ) {
          return true
        }
      }

      continue
    }

    if (typeof container !== 'object') continue

    for (const name of names) {
      const value = toBooleanOrNull(container?.[name])

      if (value !== null) return value
    }
  }

  return null
}

function normalizedRowStatus(row = {}) {
  const approval = displayApproval(row)

  return String(
    row?.status ||
      row?.requestStatus ||
      row?.approvalStatus ||
      row?.workflowStatus ||
      row?.approval?.status ||
      approval?.type ||
      approval?.status ||
      '',
  )
    .trim()
    .toUpperCase()
}

function normalizedApprovalLabel(row = {}) {
  const approval = displayApproval(row)

  return String(approval?.label || row?.statusLabel || '').trim().toUpperCase()
}

function isClosedOTRequest(row = {}) {
  const status = normalizedRowStatus(row)
  const label = normalizedApprovalLabel(row)

  if (
    [
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'CANCELED',
      'REQUESTER_DISAGREED',
    ].includes(status)
  ) {
    return true
  }

  return (
    label.includes('APPROVED') ||
    label.includes('REJECTED') ||
    label.includes('CANCELLED') ||
    label.includes('CANCELED') ||
    label.includes('DISAGREED')
  )
}

function hasApprovedStep(row = {}) {
  const directFlags = [
    row?.hasApprovedStep,
    row?.hasAnyApprovedStep,
    row?.approval?.hasApprovedStep,
    row?.approvalSummary?.hasApprovedStep,
  ]

  for (const value of directFlags) {
    const parsed = toBooleanOrNull(value)
    if (parsed === true) return true
  }

  const approvedCounts = [
    row?.approvedStepCount,
    row?.approvalApprovedCount,
    row?.approvedCount,
    row?.approval?.approvedStepCount,
    row?.approvalSummary?.approvedStepCount,
  ]

  if (approvedCounts.some((value) => Number(value || 0) > 0)) {
    return true
  }

  const stepSources = [
    row?.approvalSteps,
    row?.approvalChain,
    row?.approvals,
    row?.steps,
    row?.approval?.steps,
    row?.approvalFlow?.steps,
  ]

  const steps = stepSources.find((item) => Array.isArray(item)) || []

  return steps.some((step) => {
    const status = String(
      step?.status ||
        step?.decision ||
        step?.approvalStatus ||
        step?.action ||
        '',
    )
      .trim()
      .toUpperCase()

    return (
      status === 'APPROVED' ||
      status === 'APPROVE' ||
      Boolean(step?.approvedAt) ||
      Boolean(step?.approvedBy)
    )
  })
}

function isBeforeApprovalStarted(row = {}) {
  return !isClosedOTRequest(row) && !hasApprovedStep(row)
}

function hasOTUpdatePermission() {
  return auth?.hasPermission?.('OT_REQUEST_UPDATE') === true
}

function hasOTDeletePermission() {
  return canDeleteAnyRequest.value === true
}

function canEditRow(row = {}) {
  const explicit = readRowAction(row, 'canEdit', ['edit', 'editable'])

  if (explicit === true) return true

  return hasOTUpdatePermission() && isBeforeApprovalStarted(row)
}

function canCancelRow(row = {}) {
  const explicit = readRowAction(row, 'canCancel', ['cancel', 'cancellable'])

  if (explicit === true) return true

  return hasOTUpdatePermission() && isBeforeApprovalStarted(row)
}

function canDeleteRow(row = {}) {
  if (hasOTDeletePermission()) return true

  const explicit = readRowAction(row, 'canDelete', ['delete', 'deletable', 'remove', 'removable'])

  return explicit === true
}

function hasRowActions(row = {}) {
  return canEditRow(row) || canCancelRow(row) || canDeleteRow(row)
}

function isCancellingRow(row = {}) {
  return cancellingIds.value.has(rowIdOf(row))
}

function setCancellingRow(row = {}, value) {
  const id = rowIdOf(row)
  if (!id) return

  const next = new Set(cancellingIds.value)

  if (value) {
    next.add(id)
  } else {
    next.delete(id)
  }

  cancellingIds.value = next
}

function isDeletingRow(row = {}) {
  return deletingIds.value.has(rowIdOf(row))
}

function setDeletingRow(row = {}, value) {
  const id = rowIdOf(row)
  if (!id) return

  const next = new Set(deletingIds.value)

  if (value) {
    next.add(id)
  } else {
    next.delete(id)
  }

  deletingIds.value = next
}

function editRequest(row = {}) {
  const id = rowIdOf(row)
  if (!id || !canEditRow(row)) return

  router.push(`/ot/requests/${id}/edit`)
}

function openCancelDialog(row = {}) {
  if (!rowIdOf(row) || !canCancelRow(row)) return

  cancelTargetRow.value = row
  cancelConfirmVisible.value = true
}

function closeCancelDialog() {
  if (cancelTargetIsLoading.value) return

  cancelConfirmVisible.value = false
  cancelTargetRow.value = null
}

async function confirmCancelRequest() {
  const row = cancelTargetRow.value || {}
  const id = rowIdOf(row)

  if (!id || !canCancelRow(row)) {
    closeCancelDialog()
    return
  }

  setCancellingRow(row, true)

  try {
    await cancelOTRequest(id)

    toast.add({
      severity: 'success',
      summary: tr('common.updated', 'Updated'),
      detail: tr('ot.requests.cancelledSuccess', 'OT request cancelled successfully.'),
      life: 2500,
    })

    cancelConfirmVisible.value = false
    cancelTargetRow.value = null

    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('common.updateFailed', 'Update failed'),
      detail: getApiErrorMessage(error, tr('ot.requests.cancelFailed', 'Cancel failed.')),
      life: 4000,
    })
  } finally {
    setCancellingRow(row, false)
  }
}

function openDeleteDialog(row = {}) {
  if (!rowIdOf(row) || !canDeleteRow(row)) return

  deleteTargetRow.value = row
  deleteConfirmVisible.value = true
}

function closeDeleteDialog() {
  if (deleteTargetIsLoading.value) return

  deleteConfirmVisible.value = false
  deleteTargetRow.value = null
}

async function confirmDeleteRequest() {
  const row = deleteTargetRow.value || {}
  const id = rowIdOf(row)

  if (!id || !canDeleteRow(row)) {
    closeDeleteDialog()
    return
  }

  setDeletingRow(row, true)

  try {
    await deleteOTRequest(id)

    toast.add({
      severity: 'success',
      summary: tr('common.deleted', 'Deleted'),
      detail: tr('ot.requests.deletedSuccess', 'OT request deleted successfully.'),
      life: 2500,
    })

    deleteConfirmVisible.value = false
    deleteTargetRow.value = null

    await reloadFirstPage({ keepVisible: true })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('common.deleteFailed', 'Delete failed'),
      detail: getApiErrorMessage(error, tr('ot.requests.deleteFailed', 'Delete failed.')),
      life: 4000,
    })
  } finally {
    setDeletingRow(row, false)
  }
}

function openCreateRequest() {
  router.push('/ot/requests/create')
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
  <div class="ot-page-shell ot-request-list-page">
    <section
      ref="filterBarRef"
      class="ot-filter-bar ot-request-filter-bar"
      :class="{ 'is-filter-stacked': filterActionsStacked }"
    >
      <div class="ot-request-filter-primary">
        <div class="ot-field ot-search-field">
          <label class="ot-field-label">
            {{ tr('common.search', 'Search') }}
          </label>

          <IconField class="ot-search-icon-field">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              :placeholder="tr('common.search', 'Search')"
              class="w-full ot-request-search-input"
              inputmode="search"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              size="small"
              @input="onSearchInput"
            />
          </IconField>
        </div>

        <div class="ot-request-filter-actions">
          <span class="ot-loaded-badge">
            {{ loadedLabel }}
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
              'ot-request-action-button',
              'ot-filter-toggle-button',
              { 'has-active-filters': hasAdvancedFilters },
            ]"
            :aria-expanded="filtersPanelOpen"
            @click="toggleFilters"
          />

          <Button
            v-if="canExport"
            :label="tr('ot.requests.exportExcel', 'Export Excel')"
            icon="pi pi-file-excel"
            severity="secondary"
            outlined
            size="small"
            class="ot-request-action-button ot-request-export-button"
            :loading="exporting"
            @click="handleExport"
          />

          <Button
            v-if="canCreate"
            :label="tr('ot.requests.newRequest', 'New OT Request')"
            icon="pi pi-plus"
            size="small"
            class="ot-request-action-button"
            @click="openCreateRequest"
          />
        </div>
      </div>

      <Transition name="ot-filter-panel">
        <div
          v-show="filtersPanelOpen"
          class="ot-request-filter-panel"
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

          <div
            class="ot-field ot-date-filter-field"
            :class="{ 'is-date-open': activeDatePicker === 'from' }"
            @pointerdown.capture="setActiveDatePicker('from')"
            @focusin="setActiveDatePicker('from')"
          >
            <HolidayDatePicker
              ref="otDateFromPickerRef"
              v-model="filters.otDateFrom"
              :label="tr('ot.requests.otDateFrom', 'OT Date From')"
              :placeholder="tr('ot.requests.otDateFrom', 'OT Date From')"
              panel-class="ot-request-date-panel ot-request-date-panel-from"
              @show="onDatePickerShow('from')"
              @hide="onDatePickerHide('from')"
              @change="onFilterChange"
            />
          </div>

          <div
            class="ot-field ot-date-filter-field"
            :class="{ 'is-date-open': activeDatePicker === 'to' }"
            @pointerdown.capture="setActiveDatePicker('to')"
            @focusin="setActiveDatePicker('to')"
          >
            <HolidayDatePicker
              ref="otDateToPickerRef"
              v-model="filters.otDateTo"
              :label="tr('ot.requests.otDateTo', 'OT Date To')"
              :placeholder="tr('ot.requests.otDateTo', 'OT Date To')"
              panel-class="ot-request-date-panel ot-request-date-panel-to"
              @show="onDatePickerShow('to')"
              @hide="onDatePickerHide('to')"
              @change="onFilterChange"
            />
          </div>

          <div class="ot-request-filter-panel-actions">
            <Button
              :label="tr('common.clear', 'Clear')"
              icon="pi pi-filter-slash"
              severity="secondary"
              outlined
              size="small"
              class="ot-request-action-button"
              @click="clearFilters"
            />
          </div>
        </div>
      </Transition>
    </section>

    <section class="ot-table-card ot-request-table-card">
      <div class="ot-table-toolbar ot-request-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ tr('ot.requests.tableTitle', 'My OT Requests') }}
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
        </div>
      </div>

      <AppTableLoading
        v-if="firstLoading"
        :title="tr('ot.requests.loading', 'Loading my OT requests')"
        :message="tr('ot.requests.fetchingRecords', 'Fetching my OT request records')"
        :rows="8"
        :columns="7"
        icon="pi pi-clock"
      />

      <div
        v-else
        class="ot-request-table-shell"
      >
        <DataTable
          ref="requestDataTableRef"
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
          table-style="min-width: 53rem; table-layout: auto;"
          class="ot-request-table ot-data-table ot-data-table-compact"
          @sort="onSort"
        >
          <template #empty>
            <div
              v-if="bootstrapped"
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-clock" />
              </div>

              <div class="ot-empty-title">
                {{ tr('common.noData', 'No Data') }}
              </div>

              <div class="ot-empty-text">
                {{ tr('ot.requests.noData', 'No OT requests found for you') }}
              </div>
            </div>
          </template>

          <Column
            expander
            header-class="ot-expander-col-header"
            body-class="ot-expander-col-body"
            style="width: 2.1rem; min-width: 2.1rem; max-width: 2.1rem"
          />


          <Column
            :header="tr('ot.requests.requester', 'Requester')"
            style="width: 9.2rem; min-width: 8.8rem"
          >
            <template #body="{ data }">
              <div class="requester-cell">
                <div class="ot-request-main-text">
                  {{ displayRequester(data).name }}
                </div>

                <div class="ot-request-sub-text">
                  {{ displayRequester(data).employeeNo }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.otTime', 'OT Time')"
            style="width: 5.4rem; min-width: 5.2rem"
          >
            <template #body="{ data }">
              <Tag
                :value="displayPaidTime(data)"
                class="ot-request-rgb-tag ot-request-tag-info"
              />
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.requestStaff', 'Request Staff')"
            style="width: 5.8rem; min-width: 5.6rem"
          >
            <template #body="{ data }">
              <Tag
                :value="
                  tr('ot.requests.staffCount', `${displayStaffCount(data)} staff`, {
                    count: displayStaffCount(data),
                  })
                "
                class="ot-request-rgb-tag ot-request-tag-info"
              />
            </template>
          </Column>

          <Column
            field="otDate"
            :header="tr('ot.requests.otDate', 'OT Date')"
            sortable
            style="width: 6rem; min-width: 5.8rem"
          >
            <template #body="{ data }">
              <span class="ot-request-meta-text">
                {{ formatDateDMY(data.otDate) }}
              </span>
            </template>
          </Column>

          <Column
            field="status"
            :header="tr('ot.requests.approvalStatus', 'Approval Status')"
            sortable
            style="width: 9.4rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <div class="approval-status-cell">
                <Tag
                  :value="displayApproval(data).label"
                  :class="[
                    'ot-request-rgb-tag',
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
                <div class="ot-request-main-text">
                  {{ displayApprovedBy(data).name }}
                </div>

                <div
                  v-if="displayApprovedBy(data).employeeNo"
                  class="ot-request-sub-text"
                >
                  {{ displayApprovedBy(data).employeeNo }}
                </div>
              </div>
            </template>
          </Column>

          <Column
            :header="tr('common.action', 'Action')"
            header-class="ot-action-column-header"
            body-class="ot-action-column-body"
            style="width: 7.8rem; min-width: 7.4rem"
          >
            <template #body="{ data }">
              <div
                v-if="hasRowActions(data)"
                class="ot-row-actions"
              >
                <Button
                  v-if="canEditRow(data)"
                  :label="tr('common.edit', 'Edit')"
                  :aria-label="tr('common.edit', 'Edit')"
                  :title="tr('common.edit', 'Edit')"
                  icon="pi pi-pencil"
                  severity="info"
                  outlined
                  size="small"
                  class="ot-row-action-button ot-action-icon-responsive"
                  @click="editRequest(data)"
                />

                <Button
                  v-if="canCancelRow(data)"
                  :label="tr('common.cancel', 'Cancel')"
                  :aria-label="tr('common.cancel', 'Cancel')"
                  :title="tr('common.cancel', 'Cancel')"
                  icon="pi pi-times"
                  severity="danger"
                  outlined
                  size="small"
                  class="ot-row-action-button ot-action-icon-responsive"
                  :loading="isCancellingRow(data)"
                  :disabled="isCancellingRow(data)"
                  @click="openCancelDialog(data)"
                />

                <Button
                  v-if="canDeleteRow(data)"
                  :label="tr('common.delete', 'Delete')"
                  :aria-label="tr('common.delete', 'Delete')"
                  :title="tr('common.delete', 'Delete')"
                  icon="pi pi-trash"
                  severity="danger"
                  size="small"
                  class="ot-row-action-button ot-row-delete-button ot-action-icon-responsive"
                  :loading="isDeletingRow(data)"
                  :disabled="isDeletingRow(data)"
                  @click="openDeleteDialog(data)"
                />
              </div>

              <span
                v-else
                class="ot-action-empty"
              >
                -
              </span>
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
                      class="ot-request-rgb-tag ot-request-tag-info"
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
      v-model:visible="cancelConfirmVisible"
      modal
      class="ot-cancel-dialog"
      :header="tr('ot.requests.cancelConfirmTitle', 'Cancel OT request')"
      :style="{ width: 'min(92vw, 440px)' }"
      @hide="closeCancelDialog"
    >
      <div class="ot-cancel-dialog-body">
        <div class="ot-cancel-icon">
          <i class="pi pi-exclamation-triangle" />
        </div>

        <div class="ot-cancel-message">
          <strong>
            {{ tr('ot.requests.cancelConfirmHeading', 'Cancel this OT request?') }}
          </strong>

          <span>
            {{
              tr(
                'ot.requests.cancelConfirmHelp',
                'This request has no approved step yet. After cancel, it will no longer continue approval.',
              )
            }}
          </span>
        </div>

        <div class="ot-cancel-summary">

          <div>
            <span>{{ tr('ot.requests.approvalStatus', 'Approval Status') }}</span>
            <strong>{{ cancelTargetStatusLabel }}</strong>
          </div>

          <div>
            <span>{{ tr('ot.approval.requestedStaff', 'Staff') }}</span>
            <strong>{{ cancelTargetEmployeeCount }}</strong>
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          :label="tr('common.keep', 'Keep')"
          severity="secondary"
          outlined
          size="small"
          class="ot-dialog-button"
          :disabled="cancelTargetIsLoading"
          @click="closeCancelDialog"
        />

        <Button
          :label="tr('common.cancelRequest', 'Cancel request')"
          icon="pi pi-times"
          severity="danger"
          size="small"
          class="ot-dialog-button"
          :loading="cancelTargetIsLoading"
          @click="confirmCancelRequest"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteConfirmVisible"
      modal
      class="ot-cancel-dialog ot-delete-dialog"
      :header="tr('ot.requests.deleteConfirmTitle', 'Delete OT request')"
      :style="{ width: 'min(92vw, 460px)' }"
      @hide="closeDeleteDialog"
    >
      <div class="ot-cancel-dialog-body">
        <div class="ot-cancel-icon ot-delete-icon">
          <i class="pi pi-trash" />
        </div>

        <div class="ot-cancel-message">
          <strong>
            {{ tr('ot.requests.deleteConfirmHeading', 'Delete this OT request permanently?') }}
          </strong>

          <span>
            {{
              tr(
                'ot.requests.deleteConfirmHelp',
                'This will permanently remove the OT request and its related notifications. Use this only for test or agreed cleanup records.',
              )
            }}
          </span>
        </div>

        <div class="ot-cancel-summary">

          <div>
            <span>{{ tr('ot.requests.approvalStatus', 'Approval Status') }}</span>
            <strong>{{ deleteTargetStatusLabel }}</strong>
          </div>

          <div>
            <span>{{ tr('ot.approval.requestedStaff', 'Staff') }}</span>
            <strong>{{ deleteTargetEmployeeCount }}</strong>
          </div>
        </div>
      </div>

      <template #footer>
        <Button
          :label="tr('common.keep', 'Keep')"
          severity="secondary"
          outlined
          size="small"
          class="ot-dialog-button"
          :disabled="deleteTargetIsLoading"
          @click="closeDeleteDialog"
        />

        <Button
          :label="tr('common.delete', 'Delete')"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          class="ot-dialog-button ot-delete-confirm-button"
          :loading="deleteTargetIsLoading"
          @click="confirmDeleteRequest"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.ot-request-list-page {
  --ot-list-code-rgb: 37 99 235;
  --ot-list-green-rgb: 34 197 94;
  --ot-list-amber-rgb: 245 158 11;
  --ot-list-red-rgb: 239 68 68;
  --ot-list-blue-rgb: 59 130 246;
  --ot-list-purple-rgb: 168 85 247;
  --ot-list-muted-rgb: 100 116 139;

  --ot-request-body-bg: var(--ot-surface);
  --ot-request-head-bg: var(--ot-surface-2);
  --ot-request-head-bg-solid: var(--ot-surface-3);
  --ot-request-border: var(--ot-border);
  --ot-request-text: var(--ot-text);
  --ot-request-text-soft: var(--ot-text-soft);
  --ot-request-text-muted: var(--ot-text-muted);
  --ot-request-freeze-shadow: -10px 0 18px -16px rgb(15 23 42 / 0.7);

  isolation: isolate;
  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.9rem;
  overflow-x: hidden;
}

.ot-request-list-page,
.ot-request-list-page :deep(.p-component),
.ot-request-list-page :deep(.p-inputtext),
.ot-request-list-page :deep(.p-button),
.ot-request-list-page :deep(.p-select),
.ot-request-list-page :deep(.p-select-label) {
  font-family: var(--ot-font-main) !important;
}

/* Overlay safety */

:global(.ot-request-date-panel),
:global(.holiday-date-picker-panel),
:global(.p-datepicker-overlay),
:global(.p-datepicker-panel),
:global(.p-datepicker.p-component-overlay),
:global(.p-datepicker.p-connected-overlay),
:global(.p-calendar-panel),
:global(.p-select-overlay),
:global(.p-select-panel) {
  z-index: 40000 !important;
}

:global(.ot-request-date-panel),
:global(.holiday-date-picker-panel),
:global(.p-datepicker-overlay),
:global(.p-datepicker-panel),
:global(.p-datepicker.p-component-overlay),
:global(.p-datepicker.p-connected-overlay),
:global(.p-calendar-panel) {
  max-width: calc(100vw - 1rem) !important;
}

/* Filter */

.ot-request-filter-bar {
  position: relative;
  z-index: 5000;
  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 0.65rem;
  overflow: visible;
  border: 1px solid var(--ot-request-border);
  border-radius: var(--ot-radius-lg);
  background:
    linear-gradient(135deg, rgba(129, 166, 198, 0.12), transparent 34%),
    var(--ot-request-body-bg);
  box-shadow: var(--ot-shadow-sm);
  padding: 0.85rem;
}

.ot-request-filter-primary {
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
  color: var(--ot-request-text-soft);
  font-size: 0.74rem;
  font-weight: 700;
}

.ot-search-icon-field {
  width: 100%;
  min-width: 0;
}

.ot-search-field :deep(.ot-request-search-input.p-inputtext) {
  min-height: 2.1rem;
  font-size: 0.84rem;
}

.ot-request-filter-actions {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-request-filter-panel {
  position: relative;
  z-index: 5100;
  isolation: isolate;
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
  overflow: visible;
  border-top: 1px solid var(--ot-request-border);
  padding-top: 0.72rem;
}

.ot-request-filter-panel > .ot-field {
  position: relative;
  z-index: 1;
}

.ot-request-filter-panel > .ot-field.is-date-open,
.ot-date-filter-field.is-date-open {
  z-index: 20000;
}

.ot-date-filter-field {
  position: relative;
  overflow: visible;
}

.ot-date-filter-field.is-date-open :deep(.holiday-date-picker-field),
.ot-date-filter-field.is-date-open :deep(.holiday-date-picker),
.ot-date-filter-field.is-date-open :deep(.p-inputwrapper) {
  position: relative;
  z-index: 20001;
}

.ot-request-filter-panel-actions {
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

.ot-request-action-button {
  max-width: 100%;
  white-space: nowrap;
}

.ot-request-action-button :deep(.p-button-label) {
  overflow: hidden;
  font-size: 0.76rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-request-action-button :deep(.p-button-icon) {
  flex: 0 0 auto;
  font-size: 0.76rem;
}

.ot-filter-toggle-button.has-active-filters {
  border-color: color-mix(in srgb, var(--ot-info) 35%, transparent) !important;
  background: var(--ot-info-soft) !important;
  color: var(--ot-info) !important;
}

.ot-total-employees-badge {
  border-color: color-mix(in srgb, var(--ot-info) 35%, var(--ot-request-border));
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
  border: 1px solid var(--ot-request-border);
  border-radius: 999px;
  background: var(--ot-surface-2);
  color: var(--ot-request-text-soft);
  padding: 0.28rem 0.62rem;
  font-size: 0.74rem;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
}

/* Table card */

.ot-request-table-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--ot-request-border);
  border-radius: var(--ot-radius-lg);
  background: var(--ot-request-body-bg);
  box-shadow: var(--ot-shadow-sm);
}

.ot-request-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-request-border);
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.07), transparent 32%),
    var(--ot-request-body-bg);
  padding: 0.82rem 1rem;
}

.ot-table-title {
  margin: 0;
  color: var(--ot-request-text);
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

.ot-request-table-shell {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

/* Main table */

:deep(.ot-request-table.p-datatable) {
  max-width: 100% !important;
  min-width: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-wrapper),
:deep(.ot-request-table.p-datatable .p-datatable-table-container) {
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: auto !important;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

:deep(.ot-request-table.p-datatable .p-datatable-table) {
  min-width: 64rem !important;
  table-layout: auto !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-thead) {
  position: sticky !important;
  top: 0 !important;
  z-index: 80 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-thead > tr > th) {
  position: sticky !important;
  top: 0 !important;
  z-index: 82 !important;
  border-color: var(--ot-request-border) !important;
  background: var(--ot-request-head-bg-solid) !important;
  background-color: var(--ot-request-head-bg-solid) !important;
  background-image: none !important;
  color: var(--ot-request-text-soft) !important;
  padding: 0.54rem 0.6rem !important;
  font-size: 0.74rem !important;
  font-weight: 800 !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  opacity: 1 !important;
  box-shadow:
    0 1px 0 var(--ot-request-border),
    0 8px 14px rgb(15 23 42 / 0.045);
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr > td) {
  height: 60px !important;
  border-color: var(--ot-request-border) !important;
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
  background-image: none !important;
  padding: 0.4rem 0.6rem !important;
  color: var(--ot-request-text) !important;
  font-size: 0.78rem !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  opacity: 1 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr:hover > td) {
  background: color-mix(in srgb, var(--ot-request-body-bg) 92%, var(--ot-sky) 8%) !important;
  background-color: color-mix(in srgb, var(--ot-request-body-bg) 92%, var(--ot-sky) 8%) !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr.p-datatable-row-expansion > td) {
  height: auto !important;
  border-color: transparent !important;
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
  padding: 0.42rem 0.6rem 0.65rem !important;
}

/* Small expander column */

:deep(.ot-request-table.p-datatable .ot-expander-col-header),
:deep(.ot-request-table.p-datatable .ot-expander-col-body) {
  width: 2.1rem !important;
  min-width: 2.1rem !important;
  max-width: 2.1rem !important;
  padding-inline: 0.16rem !important;
}

:deep(.ot-request-table.p-datatable .p-row-toggler) {
  display: inline-flex !important;
  width: 1.45rem !important;
  height: 1.45rem !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 999px !important;
  color: var(--ot-info) !important;
}

:deep(.ot-request-table.p-datatable .p-row-toggler:hover) {
  background: var(--ot-info-soft) !important;
}

/* Action column */

:deep(.ot-request-table.p-datatable .ot-action-column-header),
:deep(.ot-request-table.p-datatable .ot-action-column-body) {
  position: sticky !important;
  right: 0 !important;
  z-index: 70 !important;
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
  background-image: none !important;
  opacity: 1 !important;
  isolation: isolate;
  box-shadow: var(--ot-request-freeze-shadow);
}

:deep(.ot-request-table.p-datatable .ot-action-column-header) {
  z-index: 95 !important;
  background: var(--ot-request-head-bg-solid) !important;
  background-color: var(--ot-request-head-bg-solid) !important;
  background-image: none !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr:hover .ot-action-column-body),
:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr.p-row-expanded .ot-action-column-body) {
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
  background-image: none !important;
  opacity: 1 !important;
}

/* Alignment */

:deep(.ot-request-table.p-datatable .p-datatable-column-header-content),
:deep(.ot-request-table.p-datatable .p-column-header-content) {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.25rem !important;
  text-align: center !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-column-title),
:deep(.ot-request-table.p-datatable .p-column-title) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
}

:deep(.ot-request-table.p-datatable .p-sortable-column-icon),
:deep(.ot-request-table.p-datatable .p-datatable-sort-icon) {
  margin-inline-start: 0.25rem !important;
  margin-inline-end: 0 !important;
}

:deep(.ot-request-table.p-datatable .p-datatable-tbody > tr > td > *) {
  margin-inline: auto !important;
}

:deep(.ot-request-table.p-datatable .p-tag),
:deep(.ot-request-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.ot-request-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
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

.ot-request-main-text {
  max-width: 8rem;
  overflow: hidden;
  color: var(--ot-request-text);
  font-family: var(--ot-font-km) !important;
  font-size: 0.8rem;
  font-weight: 660;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-request-sub-text {
  max-width: 7.6rem;
  overflow: hidden;
  color: var(--ot-request-text-muted);
  font-size: 0.7rem;
  font-weight: 520;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-request-meta-text {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--ot-request-text-soft);
  font-size: 0.76rem;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Tags / actions */

.ot-request-rgb-tag {
  --ot-request-tag-rgb: var(--ot-list-muted-rgb);

  display: inline-flex !important;
  min-height: 1.36rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--ot-request-tag-rgb) / 0.28) !important;
  border-radius: 999px !important;
  background: rgb(var(--ot-request-tag-rgb) / 0.11) !important;
  color: rgb(var(--ot-request-tag-rgb)) !important;
  padding: 0.1rem 0.46rem !important;
  font-size: 0.68rem !important;
  font-weight: 730 !important;
  line-height: 1 !important;
  text-align: center !important;
  white-space: nowrap !important;
}

.approval-display-tag {
  max-width: 9rem;
}

.ot-request-tag-approved {
  --ot-request-tag-rgb: var(--ot-list-green-rgb);
}

.ot-request-tag-rejected {
  --ot-request-tag-rgb: var(--ot-list-red-rgb);
}

.ot-request-tag-pending {
  --ot-request-tag-rgb: var(--ot-list-amber-rgb);
}

.ot-request-tag-info {
  --ot-request-tag-rgb: var(--ot-list-blue-rgb);
}

.ot-request-tag-muted {
  --ot-request-tag-rgb: var(--ot-list-muted-rgb);
}

.ot-request-tag-purple {
  --ot-request-tag-rgb: var(--ot-list-purple-rgb);
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

.ot-row-action-button {
  width: 100%;
  min-height: 1.66rem;
  padding-inline: 0.45rem;
  white-space: nowrap;
}

.ot-row-action-button :deep(.p-button-label) {
  font-size: 0.7rem;
  font-weight: 620;
}

.ot-row-action-button :deep(.p-button-icon) {
  font-size: 0.7rem;
}

.ot-action-empty {
  color: var(--ot-request-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

/* Expanded child table */

.ot-expanded-box {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--ot-request-border);
  border-radius: 0.9rem;
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
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
  border: 1px solid var(--ot-request-border);
  border-radius: 0.78rem;
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
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
  border-bottom: 1px solid var(--ot-request-border);
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
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
  border-right: 1px solid var(--ot-request-border);
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
  background-image: none !important;
  padding: 0.4rem 0.48rem;
  color: var(--ot-request-text-soft);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.24;
  text-align: center;
  background-clip: border-box !important;
}

.ot-expanded-grid-row > div:last-child {
  border-right: 0;
}

.ot-expanded-grid-row.is-head {
  position: sticky !important;
  top: 0 !important;
  z-index: 60 !important;
  min-height: 2.15rem;
  background: var(--ot-request-head-bg-solid) !important;
  background-color: var(--ot-request-head-bg-solid) !important;
  background-image: none !important;
  opacity: 1 !important;
  box-shadow:
    0 1px 0 var(--ot-request-border),
    0 8px 14px rgb(15 23 42 / 0.08);
}

.ot-expanded-grid-row.is-head > div {
  position: relative;
  z-index: 61 !important;
  border-right: 1px solid var(--ot-request-border);
  background: var(--ot-request-head-bg-solid) !important;
  background-color: var(--ot-request-head-bg-solid) !important;
  background-image: none !important;
  color: var(--ot-request-text-soft);
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
  color: var(--ot-request-text) !important;
  font-family: var(--ot-font-km) !important;
  font-weight: 650 !important;
}

.cell-wrap {
  overflow-wrap: anywhere;
  white-space: normal;
}

.ot-expanded-empty {
  border: 1px dashed var(--ot-request-border);
  border-radius: 0.85rem;
  background: var(--ot-request-body-bg) !important;
  background-color: var(--ot-request-body-bg) !important;
  color: var(--ot-request-text-muted);
  padding: 0.85rem;
  font-size: 0.8rem;
  font-weight: 520;
  text-align: center;
}

/* Bottom / empty state */

.ot-list-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-top: 1px solid var(--ot-request-border);
  background: var(--ot-request-body-bg);
  padding: 0.65rem;
}

.ot-all-loaded-text {
  color: var(--ot-request-text-muted);
  font-size: 0.74rem;
  font-weight: 600;
}

.ot-empty-state {
  display: flex;
  min-height: 14rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 2rem;
  color: var(--ot-request-text-muted);
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
  color: var(--ot-request-text);
  font-size: 0.95rem;
  font-weight: 800;
}

.ot-empty-text {
  max-width: 26rem;
  font-size: 0.82rem;
  line-height: 1.4;
  text-align: center;
}

/* Cancel dialog */

.ot-cancel-dialog-body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}

.ot-cancel-icon {
  display: grid;
  width: 2.45rem;
  height: 2.45rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--ot-danger) 35%, transparent);
  border-radius: 999px;
  background: var(--ot-danger-soft);
  color: var(--ot-danger);
  font-size: 1rem;
}

.ot-cancel-message {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25rem;
}

.ot-cancel-message strong {
  color: var(--ot-request-text);
  font-size: 0.95rem;
  font-weight: 750;
  line-height: 1.25;
}

.ot-cancel-message span {
  color: var(--ot-request-text-muted);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.4;
}

.ot-cancel-summary {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.2rem;
}

.ot-cancel-summary div {
  min-width: 0;
  border: 1px solid var(--ot-request-border);
  border-radius: 0.75rem;
  background: var(--ot-surface-2);
  padding: 0.52rem 0.6rem;
}

.ot-cancel-summary span {
  display: block;
  overflow: hidden;
  color: var(--ot-request-text-muted);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.035em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.ot-cancel-summary strong {
  display: block;
  overflow: hidden;
  margin-top: 0.12rem;
  color: var(--ot-request-text);
  font-size: 0.8rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-dialog-button {
  min-width: 6rem;
}

:deep(.ot-cancel-dialog .p-dialog-header) {
  padding: 0.85rem 1rem 0.5rem !important;
}

:deep(.ot-cancel-dialog .p-dialog-content) {
  padding: 0.55rem 1rem 0.8rem !important;
}

:deep(.ot-cancel-dialog .p-dialog-footer) {
  gap: 0.45rem;
  border-top: 1px solid var(--ot-request-border);
  padding: 0.65rem 1rem 0.85rem !important;
}

/* Dark mode */

:global(.dark) .ot-request-list-page {
  --ot-list-muted-rgb: 203 213 225;

  --ot-request-body-bg: var(--ot-surface);
  --ot-request-head-bg: var(--ot-surface-2);
  --ot-request-head-bg-solid: var(--ot-surface-3);
  --ot-request-border: var(--ot-border);
  --ot-request-text: var(--ot-text);
  --ot-request-text-soft: var(--ot-text-soft);
  --ot-request-text-muted: var(--ot-text-muted);
  --ot-request-freeze-shadow: -10px 0 18px -16px rgb(0 0 0 / 0.95);
}

:global(.dark) .ot-request-rgb-tag {
  border-color: rgb(var(--ot-request-tag-rgb) / 0.42) !important;
  background: rgb(var(--ot-request-tag-rgb) / 0.18) !important;
}

/* Responsive */

@media (max-width: 1100px) {
  .ot-request-filter-primary {
    grid-template-columns: 1fr;
  }

  .ot-request-filter-actions {
    justify-content: flex-start;
  }

  .ot-request-filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-request-filter-panel-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .ot-request-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-table-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .ot-request-list-page {
    gap: 0.55rem;
    touch-action: manipulation;
  }

  .ot-request-filter-bar {
    gap: 0.5rem;
    border-radius: var(--ot-radius-md);
    padding: 0.55rem;
  }

  .ot-request-filter-primary {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .ot-search-field .ot-field-label {
    display: none;
  }

  .ot-request-list-page :deep(input),
  .ot-request-list-page :deep(textarea),
  .ot-request-list-page :deep(select),
  .ot-request-list-page :deep(.p-inputtext),
  .ot-request-list-page :deep(.p-select),
  .ot-request-list-page :deep(.p-select-label),
  .ot-request-list-page :deep(.p-datepicker input),
  .ot-request-list-page :deep(.p-calendar input),
  .ot-request-list-page :deep(.p-inputwrapper input) {
    font-size: 16px !important;
  }

  .ot-search-field :deep(.ot-request-search-input.p-inputtext) {
    min-height: 2.25rem;
    font-size: 16px !important;
    line-height: 1.2;
  }

  .ot-date-filter-field :deep(.p-inputtext),
  .ot-date-filter-field :deep(input) {
    min-height: 2.25rem;
    font-size: 16px !important;
    line-height: 1.2;
  }

  .ot-request-filter-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    justify-content: stretch;
  }

  .ot-request-filter-actions > * {
    min-width: 0;
  }

  .ot-loaded-badge {
    grid-column: 1 / -1;
    width: 100%;
    min-height: 1.55rem;
    padding: 0.18rem 0.45rem;
    font-size: 0.68rem;
  }

  .ot-request-action-button {
    width: 100%;
    min-height: 2rem;
    justify-content: center;
  }

  .ot-request-action-button :deep(.p-button-label) {
    font-size: 0.72rem;
  }

  .ot-request-filter-panel {
    z-index: 5100;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    overflow: visible;
    padding-top: 0.55rem;
  }

  .ot-request-filter-panel-actions {
    justify-content: stretch;
  }

  .ot-filter-panel-enter-to,
  .ot-filter-panel-leave-from {
    max-height: 18rem;
  }

  .ot-request-table-card {
    border-radius: var(--ot-radius-md);
  }

  .ot-request-table-toolbar {
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

  .ot-request-table-shell {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  :deep(.ot-request-table.p-datatable .p-datatable-wrapper),
  :deep(.ot-request-table.p-datatable .p-datatable-table-container) {
    max-height: 64vh !important;
    overflow-x: auto !important;
    overflow-y: auto !important;
    overscroll-behavior-x: contain;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  :deep(.ot-request-table.p-datatable .p-datatable-table) {
    min-width: 42rem !important;
    table-layout: auto !important;
  }

  :deep(.ot-request-table.p-datatable .p-datatable-thead > tr > th) {
    padding: 0.34rem 0.38rem !important;
    font-size: 0.66rem !important;
  }

  :deep(.ot-request-table.p-datatable .p-datatable-tbody > tr > td) {
    height: 44px !important;
    padding: 0.26rem 0.38rem !important;
    font-size: 0.7rem !important;
  }

  :deep(.ot-request-table.p-datatable .ot-expander-col-header),
  :deep(.ot-request-table.p-datatable .ot-expander-col-body) {
    width: 1.9rem !important;
    min-width: 1.9rem !important;
    max-width: 1.9rem !important;
    padding-inline: 0.12rem !important;
  }

  :deep(.ot-request-table.p-datatable .p-row-toggler) {
    width: 1.35rem !important;
    height: 1.35rem !important;
  }

  .ot-request-no-text {
    font-size: 0.7rem;
  }

  .ot-request-main-text {
    max-width: 7rem;
    font-size: 0.7rem;
  }

  .ot-request-sub-text {
    max-width: 6.8rem;
    font-size: 0.6rem;
  }

  .ot-request-meta-text {
    font-size: 0.66rem;
  }

  .ot-request-rgb-tag {
    min-height: 1.14rem;
    padding: 0.07rem 0.32rem !important;
    font-size: 0.6rem !important;
  }

  :deep(.ot-request-table.p-datatable .ot-action-column-header),
  :deep(.ot-request-table.p-datatable .ot-action-column-body) {
    width: 2.45rem !important;
    min-width: 2.45rem !important;
    max-width: 2.45rem !important;
    padding: 0.18rem 0.12rem !important;
  }

  :deep(.ot-request-table.p-datatable .ot-action-column-header .p-column-title),
  :deep(.ot-request-table.p-datatable .ot-action-column-header .p-datatable-column-title) {
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

  .ot-list-bottom-bar {
    flex-direction: column;
    align-items: stretch;
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

  .ot-cancel-dialog-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .ot-cancel-icon {
    width: 2.25rem;
    height: 2.25rem;
  }

  .ot-cancel-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .ot-dialog-button {
    width: 100%;
  }
}

@media (max-width: 640px) {
  :deep(.ot-cancel-dialog .p-dialog-footer) {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
}
</style>