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

import { getApiErrorMessage } from '@/shared/utils/apiError'
import { useOTRealtimeRefresh } from '@/modules/ot/otRealtimeRefresh'

import {
  decideOTRequest,
  exportOTApprovalInboxExcel,
  getOTApprovalInbox,
} from '@/modules/ot/ot.api'

import {
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
const FILTER_STACK_WIDTH = 1380

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const loadingPages = ref(new Set())
const expandedRows = ref({})
const selectedRequestIds = ref([])

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const loadingMore = ref(false)
const exporting = ref(false)

const tableScrollShell = ref(null)
const filterBarRef = ref(null)
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

const statusOptions = computed(() => [
  { label: tr('common.allStatus', 'All Status'), value: '' },
  { label: tr('ot.status.pending', 'Pending'), value: 'PENDING' },
  {
    label: tr('ot.status.pendingRequesterConfirmation', 'Waiting Requester Confirmation'),
    value: 'PENDING_REQUESTER_CONFIRMATION',
  },
  { label: tr('ot.status.approved', 'Approved'), value: 'APPROVED' },
  { label: tr('ot.status.rejected', 'Rejected'), value: 'REJECTED' },
  { label: tr('ot.status.requesterDisagreed', 'Requester Disagreed'), value: 'REQUESTER_DISAGREED' },
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

function tr(key, fallback, params) {
  const value = t(key, params || {})

  if (!value || value === key) return fallback

  return value
}

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

function displayApproval(row) {
  return getApprovalDisplay(row)
}

function displayApprovalTagClass(row) {
  return getApprovalTagClass(row, 'ot-approval')
}

function displayStaffCount(row) {
  return Number(row?.effectiveEmployeeCount || row?.requestedEmployeeCount || getEmployeeCount(row) || 0)
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

  const code = String(
    employee?.lineCode ||
      employee?.productionLineCode ||
      line?.code ||
      line?.lineCode ||
      line?.productionLineCode ||
      '',
  ).trim()

  const name = String(
    employee?.lineName ||
      employee?.productionLineName ||
      line?.name ||
      line?.lineName ||
      line?.productionLineName ||
      '',
  ).trim()

  if (code && name && code !== name) return `${code} · ${name}`

  return code || name || '-'
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

    totalRecords.value = total

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
      detail: getApiErrorMessage(error, tr('ot.approval.loadFailed', 'Failed to load approval inbox')),
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
    expandedRows.value = {}
    selectedRequestIds.value = []
    bootstrapped.value = false
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
    version: queryVersion,
  })

  if (tableScrollShell.value && !keepVisible) {
    tableScrollShell.value.scrollTop = 0
  }
}

async function loadNextPage() {
  if (loadingMore.value) return
  if (backgroundLoading.value) return
  if (!hasMorePages.value) return

  const loaded = [...loadedPages.value]
  const nextPage = loaded.length ? Math.max(...loaded) + 1 : 1

  loadingMore.value = true

  try {
    await fetchPage(nextPage, {
      replace: false,
      silent: false,
      version: queryVersion,
    })
  } finally {
    loadingMore.value = false
  }
}

function onTableScroll(event) {
  const element = event?.target
  if (!element) return
  if (!hasMorePages.value) return
  if (loadingMore.value || backgroundLoading.value) return

  const distanceToBottom =
    element.scrollHeight - element.scrollTop - element.clientHeight

  if (distanceToBottom <= SCROLL_LOAD_DISTANCE) {
    loadNextPage()
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

    downloadBlob(blob, getFilenameFromHeader(res, `ot-approval-inbox-${Date.now()}.xlsx`))

    toast.add({
      severity: 'success',
      summary: tr('ot.approval.exported', 'Exported'),
      detail: tr('ot.approval.exportedSuccess', 'Approval inbox exported successfully'),
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: tr('ot.approval.exportFailed', 'Export Failed'),
      detail: getApiErrorMessage(error, tr('ot.approval.exportFailed', 'Failed to export approval inbox')),
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

  if (decisionDialog.action === 'REJECT' && !String(decisionDialog.remark || '').trim()) {
    toast.add({
      severity: 'warn',
      summary: tr('common.warning', 'Warning'),
      detail: tr('ot.approval.rejectionRemarkRequired', 'Please enter a rejection remark'),
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
      detail: getApiErrorMessage(error, tr('ot.approval.decisionFailed', 'Failed to save decision')),
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
            ? tr('ot.approval.bulkPartial', `${successCount} approved, ${failedCount} failed`, {
                success: successCount,
                failed: failedCount,
              })
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
      detail: getApiErrorMessage(error, tr('ot.approval.bulkFailed', 'Bulk approval failed')),
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
      <div class="ot-field">
        <label class="ot-field-label">
          {{ tr('common.search', 'Search') }}
        </label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="tr('common.search', 'Search')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

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

      <div class="ot-approval-filter-actions">
        <span class="ot-loaded-badge">
          {{ summaryText }}
        </span>

        <Button
          :label="tr('common.clear', 'Clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          class="ot-approval-action-button"
          @click="clearFilters"
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
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
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
            :label="tr('ot.approval.bulkApproveSelected', `Approve Selected (${selectedBulkCount})`, {
              count: selectedBulkCount,
            })"
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
        ref="tableScrollShell"
        class="ot-approval-table-scroll"
        @scroll.passive="onTableScroll"
      >
        <DataTable
          v-model:expandedRows="expandedRows"
          :value="rows"
          data-key="id"
          lazy
          removable-sort
          row-hover
          :sort-field="filters.sortBy"
          :sort-order="filters.sortOrder"
          table-style="width: max-content; min-width: 100%; table-layout: auto;"
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

          <Column style="width: 3.25rem; min-width: 3.25rem">
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
            style="width: 3.2rem; min-width: 3.2rem"
          />

          <Column
            field="requestNo"
            :header="tr('ot.requests.requestNo', 'Request No')"
            sortable
            style="width: 10rem; min-width: 10rem"
          >
            <template #body="{ data }">
              <span class="ot-request-no-text">
                {{ data.requestNo || data.otRequestNo || '-' }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.requester', 'Requester')"
            style="width: 14rem; min-width: 14rem"
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
            style="width: 16rem; min-width: 16rem"
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
            :header="tr('ot.approval.requestedStaff', 'Staff')"
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                :value="tr('ot.requests.staffCount', `${displayStaffCount(data)} staff`, {
                  count: displayStaffCount(data),
                })"
                class="ot-approval-rgb-tag ot-approval-tag-info"
              />
            </template>
          </Column>

          <Column
            field="otDate"
            :header="tr('ot.requests.otDate', 'OT Date')"
            sortable
            style="width: 9rem; min-width: 9rem"
          >
            <template #body="{ data }">
              <span class="ot-meta-text">
                {{ formatDateDMY(data.otDate) }}
              </span>
            </template>
          </Column>

          <Column
            :header="tr('ot.requests.otTime', 'OT Time')"
            style="width: 9rem; min-width: 9rem"
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
            style="width: 12.5rem; min-width: 12.5rem"
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
            style="width: 13rem; min-width: 13rem"
          >
            <template #body="{ data }">
              <div class="ot-row-actions">
                <Button
                  v-if="canApprove(data)"
                  :label="tr('ot.approval.approve', 'Approve')"
                  icon="pi pi-check"
                  size="small"
                  class="ot-action-mini ot-approve-button"
                  @click="openDecision(data, 'APPROVE')"
                />

                <Button
                  v-if="canReject(data)"
                  :label="tr('ot.approval.reject', 'Reject')"
                  icon="pi pi-times"
                  severity="danger"
                  outlined
                  size="small"
                  class="ot-action-mini"
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

        <div
          v-if="bootstrapped && hasAnyData"
          class="ot-list-bottom-bar"
        >
          <span class="ot-loaded-badge">
            {{ summaryText }}
          </span>

          <Button
            v-if="hasMorePages"
            :label="loadingMore ? 'Loading more...' : 'Load more'"
            icon="pi pi-angle-down"
            severity="secondary"
            outlined
            size="small"
            class="ot-approval-action-button"
            :loading="loadingMore"
            @click="loadNextPage"
          />

          <span
            v-else
            class="ot-all-loaded-text"
          >
            All matched requests loaded
          </span>
        </div>
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
              ? tr('ot.approval.rejectRemarkPlaceholder', 'Please enter reason for rejection')
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
                tr('ot.approval.bulkSummary', `${bulkRequestCount} requests · ${bulkEmployeeCount} employees`, {
                  requests: bulkRequestCount,
                  employees: bulkEmployeeCount,
                })
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
  --ot-list-text-rgb: 15 23 42;
  --ot-list-muted-rgb: 100 116 139;
  --ot-list-soft-rgb: 148 163 184;
  --ot-list-green-rgb: 34 197 94;
  --ot-list-amber-rgb: 245 158 11;
  --ot-list-red-rgb: 239 68 68;
  --ot-list-blue-rgb: 59 130 246;
  --ot-list-purple-rgb: 168 85 247;
  --ot-list-row-border: 148 163 184;

  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex-direction: column;
  gap: 1rem;
  overflow-x: hidden;
}

.ot-approval-page,
.ot-approval-page :deep(.p-component),
.ot-approval-page :deep(.p-inputtext),
.ot-approval-page :deep(.p-button),
.ot-approval-page :deep(.p-select),
.ot-approval-page :deep(.p-select-label) {
  font-family: inherit;
}

.ot-approval-filter-bar {
  display: grid;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  grid-template-columns:
    minmax(220px, 1.25fr)
    minmax(150px, 0.75fr)
    minmax(170px, 0.85fr)
    minmax(170px, 0.85fr)
    minmax(0, auto);
  gap: 0.75rem;
  align-items: end;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 1.05rem;
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.055), transparent 34%),
    var(--surface-card);
  box-shadow: 0 12px 34px rgb(15 23 42 / 0.055);
  padding: 0.85rem;
}

.ot-approval-filter-bar.is-filter-stacked {
  grid-template-columns:
    minmax(220px, 1.25fr)
    minmax(150px, 0.75fr)
    minmax(170px, 0.85fr)
    minmax(170px, 0.85fr);
}

.ot-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
}

.ot-field-label {
  color: var(--text-color-secondary);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.ot-approval-filter-actions {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.ot-approval-filter-bar.is-filter-stacked .ot-approval-filter-actions {
  grid-column: 1 / -1;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.ot-approval-action-button {
  max-width: 100%;
  white-space: nowrap;
}

.ot-approval-action-button :deep(.p-button-label) {
  overflow: hidden;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-action-button :deep(.p-button-icon) {
  flex: 0 0 auto;
  font-size: 0.76rem;
}

.ot-loaded-badge {
  display: inline-flex;
  min-height: 1.9rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid rgb(var(--ot-list-blue-rgb) / 0.22);
  border-radius: 999px;
  background: rgb(var(--ot-list-blue-rgb) / 0.09);
  color: rgb(var(--ot-list-blue-rgb));
  padding: 0.28rem 0.62rem;
  font-size: 0.74rem;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
}

.ot-table-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  border-radius: 1.15rem;
  background: var(--surface-card);
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.07);
}

.ot-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid rgb(var(--ot-list-row-border) / 0.14);
  background:
    linear-gradient(135deg, rgb(var(--ot-list-green-rgb) / 0.055), transparent 32%),
    var(--surface-card);
  padding: 0.82rem 1rem;
}

.ot-table-title {
  margin: 0;
  color: var(--text-color);
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

.ot-approval-table-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  max-height: min(66vh, 660px);
  min-height: 22rem;
  overflow: auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

:deep(.ot-approval-table.p-datatable) {
  max-width: 100% !important;
  min-width: 0 !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-wrapper) {
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: visible !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-thead > tr > th) {
  position: sticky !important;
  top: 0;
  z-index: 5;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  border-color: rgb(var(--ot-list-row-border) / 0.14) !important;
  background: var(--surface-ground) !important;
  color: var(--text-color-secondary) !important;
  padding: 0.58rem 0.68rem !important;
  font-size: 0.76rem !important;
  font-weight: 750 !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr > td) {
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
  height: 64px !important;
  border-color: rgb(var(--ot-list-row-border) / 0.08) !important;
  padding: 0.44rem 0.68rem !important;
  color: var(--text-color) !important;
  font-size: 0.8rem !important;
  text-align: center !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr.p-datatable-row-expansion > td) {
  height: auto !important;
  border-color: transparent !important;
  padding: 0.45rem 0.75rem 0.75rem !important;
  background: transparent !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr:hover) {
  background: rgb(var(--ot-list-blue-rgb) / 0.03) !important;
}

:deep(.ot-approval-table.p-datatable .p-datatable-tbody > tr.p-row-expanded) {
  background: rgb(var(--ot-list-blue-rgb) / 0.035) !important;
}

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

:deep(.ot-approval-table.p-datatable .p-row-toggler) {
  display: inline-flex !important;
  width: 1.85rem !important;
  height: 1.85rem !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 999px !important;
  color: rgb(var(--ot-list-blue-rgb)) !important;
}

:deep(.ot-approval-table.p-datatable .p-row-toggler:hover) {
  background: rgb(var(--ot-list-blue-rgb) / 0.1) !important;
}

:deep(.ot-approval-table.p-datatable .p-checkbox) {
  display: inline-flex !important;
  margin-inline: auto !important;
}

:deep(.ot-approval-table.p-datatable .p-tag),
:deep(.ot-approval-table.p-datatable .p-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-inline: auto !important;
  text-align: center !important;
}

:deep(.ot-approval-table.p-datatable .p-tag-value) {
  max-width: 100%;
  overflow: hidden;
  text-align: center !important;
  text-overflow: ellipsis;
}

.ot-request-no-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--ot-list-code-rgb));
  font-size: 0.82rem;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.005em;
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
  max-width: 13rem;
  overflow: hidden;
  color: rgb(var(--ot-list-text-rgb));
  font-size: 0.82rem;
  font-weight: 660;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-sub-text {
  max-width: 12rem;
  overflow: hidden;
  color: var(--text-color-secondary);
  font-size: 0.71rem;
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
  color: rgb(var(--ot-list-muted-rgb));
  font-size: 0.78rem;
  font-weight: 560;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-rgb-tag {
  --ot-approval-tag-rgb: var(--ot-list-muted-rgb);

  display: inline-flex !important;
  min-height: 1.42rem;
  max-width: 100%;
  align-items: center !important;
  justify-content: center !important;
  border: 1px solid rgb(var(--ot-approval-tag-rgb) / 0.28) !important;
  border-radius: 999px !important;
  background: rgb(var(--ot-approval-tag-rgb) / 0.11) !important;
  color: rgb(var(--ot-approval-tag-rgb)) !important;
  padding: 0.12rem 0.5rem !important;
  font-size: 0.7rem !important;
  font-weight: 730 !important;
  line-height: 1 !important;
  text-align: center !important;
  white-space: nowrap !important;
}

.approval-display-tag {
  max-width: 13.5rem;
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
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
}

.ot-action-mini {
  min-height: 1.9rem;
  padding-inline: 0.62rem;
  white-space: nowrap;
}

.ot-action-mini :deep(.p-button-label) {
  font-size: 0.73rem;
  font-weight: 620;
}

.ot-action-mini :deep(.p-button-icon) {
  font-size: 0.72rem;
}

.ot-approve-button {
  border-color: rgb(var(--ot-list-green-rgb)) !important;
  background: rgb(var(--ot-list-green-rgb)) !important;
  color: #ffffff !important;
}

.ot-approve-button:hover {
  border-color: #15803d !important;
  background: #15803d !important;
  color: #ffffff !important;
}

.ot-muted-action {
  color: var(--text-color-secondary);
  font-size: 0.72rem;
  font-weight: 620;
  white-space: nowrap;
}

.ot-expanded-box {
  max-width: 100%;
  min-width: 0;
  border: 1px solid rgb(var(--ot-list-blue-rgb) / 0.12);
  border-radius: 0.95rem;
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.035), transparent 35%),
    var(--surface-ground);
  padding: 0.72rem;
}

.ot-expanded-table-scroll {
  max-width: 100%;
  min-width: 740px;
  max-height: 19rem;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid rgb(var(--ot-list-row-border) / 0.12);
  border-radius: 0.85rem;
  background: var(--surface-card);
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    4rem
    9rem
    minmax(12rem, 1.2fr)
    minmax(10rem, 1fr)
    8rem
    minmax(10rem, 1fr);
  min-height: 2.55rem;
  align-items: center;
  border-bottom: 1px solid rgb(var(--ot-list-row-border) / 0.075);
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
  border-right: 1px solid rgb(var(--ot-list-row-border) / 0.07);
  padding: 0.48rem 0.62rem;
  color: var(--text-color-secondary);
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1.28;
  text-align: center;
}

.ot-expanded-grid-row > div:last-child {
  border-right: 0;
}

.ot-expanded-grid-row.is-head {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 2.35rem;
  background: var(--surface-ground);
}

.ot-expanded-grid-row.is-head > div {
  color: var(--text-color-secondary);
  font-size: 0.7rem;
  font-weight: 740;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.cell-center {
  text-align: center;
}

.cell-code {
  color: rgb(var(--ot-list-blue-rgb)) !important;
  font-weight: 700 !important;
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  color: var(--text-color) !important;
  font-weight: 650 !important;
}

.cell-wrap {
  overflow-wrap: anywhere;
  white-space: normal;
}

.ot-expanded-empty {
  border: 1px dashed rgb(var(--ot-list-row-border) / 0.18);
  border-radius: 0.85rem;
  background: var(--surface-card);
  color: var(--text-color-secondary);
  padding: 0.85rem;
  font-size: 0.8rem;
  font-weight: 520;
  text-align: center;
}

.ot-list-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-top: 1px solid rgb(var(--ot-list-row-border) / 0.1);
  background: var(--surface-card);
  padding: 0.65rem;
}

.ot-all-loaded-text {
  color: var(--text-color-secondary);
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
  color: var(--text-color-secondary);
}

.ot-empty-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 999px;
  background: rgb(var(--ot-list-blue-rgb) / 0.1);
  color: rgb(var(--ot-list-blue-rgb));
  font-size: 1.25rem;
}

.ot-empty-title {
  color: var(--text-color);
  font-size: 0.95rem;
  font-weight: 800;
}

.ot-empty-text {
  max-width: 26rem;
  font-size: 0.82rem;
  line-height: 1.4;
  text-align: center;
}

/* =========================
   Dialogs
   ========================= */

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
  border: 1px solid rgb(var(--ot-list-green-rgb) / 0.3);
  border-radius: 999px;
  background: rgb(var(--ot-list-green-rgb) / 0.12);
  color: rgb(var(--ot-list-green-rgb));
  font-size: 0.95rem;
}

.ot-dialog-icon.is-danger {
  border-color: rgb(var(--ot-list-red-rgb) / 0.3);
  background: rgb(var(--ot-list-red-rgb) / 0.12);
  color: rgb(var(--ot-list-red-rgb));
}

.ot-dialog-title {
  color: var(--text-color);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.25;
}

.ot-dialog-subtitle {
  margin-top: 0.1rem;
  color: var(--text-color-secondary);
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
  border: 1px solid rgb(var(--ot-list-row-border) / 0.12);
  border-radius: 0.85rem;
  background: var(--surface-ground);
  padding: 0.64rem;
}

.ot-dialog-summary span {
  color: var(--text-color-secondary);
  font-size: 0.68rem;
  font-weight: 760;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.ot-dialog-summary strong {
  overflow-wrap: anywhere;
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 760;
}

.ot-dialog-label {
  color: var(--text-color-secondary);
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
  border-color: var(--surface-border);
  background: var(--surface-card);
  color: var(--text-color-secondary);
}

.ot-native-dialog-button.is-cancel:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-color);
}

.ot-native-dialog-button.is-approve {
  border-color: rgb(var(--ot-list-green-rgb));
  background: rgb(var(--ot-list-green-rgb));
  color: #ffffff;
}

.ot-native-dialog-button.is-approve:hover:not(:disabled) {
  border-color: #15803d !important;
  background: #15803d !important;
  color: #ffffff !important;
}

.ot-native-dialog-button.is-reject {
  border-color: rgb(var(--ot-list-red-rgb));
  background: rgb(var(--ot-list-red-rgb));
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

/* =========================
   Dark mode
   ========================= */

:global(.dark) .ot-approval-page {
  --ot-list-text-rgb: 226 232 240;
  --ot-list-muted-rgb: 203 213 225;
  --ot-list-row-border: 71 85 105;
}

:global(.dark) .ot-approval-rgb-tag {
  border-color: rgb(var(--ot-approval-tag-rgb) / 0.42) !important;
  background: rgb(var(--ot-approval-tag-rgb) / 0.18) !important;
}

:global(.dark) .ot-expanded-box {
  border-color: rgb(var(--ot-list-blue-rgb) / 0.22);
  background:
    linear-gradient(135deg, rgb(var(--ot-list-blue-rgb) / 0.075), transparent 35%),
    var(--surface-ground);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 1100px) {
  .ot-approval-filter-bar,
  .ot-approval-filter-bar.is-filter-stacked {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-approval-filter-actions,
  .ot-approval-filter-bar.is-filter-stacked .ot-approval-filter-actions {
    grid-column: 1 / -1;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .ot-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-table-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .ot-approval-filter-bar,
  .ot-approval-filter-bar.is-filter-stacked {
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }

  .ot-approval-filter-actions,
  .ot-approval-filter-bar.is-filter-stacked .ot-approval-filter-actions {
    align-items: stretch;
    justify-content: stretch;
  }

  .ot-approval-filter-actions > * {
    flex: 1 1 100%;
  }

  .ot-loaded-badge,
  .ot-approval-action-button {
    width: 100%;
    justify-content: center;
  }

  .ot-approval-table-scroll {
    max-height: 64vh;
  }

  .ot-list-bottom-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-dialog-summary {
    grid-template-columns: 1fr;
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