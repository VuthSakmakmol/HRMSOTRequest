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
let currentRequestId = 0

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
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalInbox.value > PAGE_SIZE)

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

function employeeDepartmentOf(employee) {
  return String(
    employee?.departmentName ||
      employee?.department?.name ||
      employee?.departmentSnapshot?.name ||
      '-',
  ).trim() || '-'
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
    const total = normalizeTotal(payload)
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
      expandedRows.value = {}
      selectedRequestIds.value = []
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]

      for (let index = 0; index < items.length; index += 1) {
        nextRows[startIndex + index] = items[index]
      }

      rows.value = nextRows
      loadedPages.value.add(page)
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
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
    expandedRows.value = {}
    selectedRequestIds.value = []
    bootstrapped.value = false
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
  })
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
  filters.sortBy = event.sortField || 'createdAt'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1

  reloadFirstPage({ keepVisible: true })
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
  reloadFirstPage({ keepVisible: false })
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
      />

      <DataTable
        v-else
        v-model:expandedRows="expandedRows"
        :value="rows"
        data-key="id"
        lazy
        removable-sort
        scrollable
        scroll-height="500px"
        :sort-field="filters.sortBy"
        :sort-order="filters.sortOrder"
        table-style="width: max-content; min-width: 100%; table-layout: auto;"
        class="ot-approval-table ot-data-table ot-data-table-compact"
        :virtual-scroller-options="
          useVirtualScroll
            ? {
                lazy: true,
                onLazyLoad: onVirtualLazyLoad,
                itemSize: 76,
                delay: 0,
                showLoader: false,
                loading: false,
                numToleratedItems: 12,
              }
            : null
        "
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
          style="width: 3.25rem; min-width: 3.25rem"
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
          style="width: 3rem; min-width: 3rem"
        />

        <Column
          field="requestNo"
          :header="tr('ot.requests.requestNo', 'Request No')"
          sortable
          style="width: 10rem; min-width: 10rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-request-no-text"
            >
              {{ data.requestNo || data.otRequestNo || '-' }}
            </span>
          </template>
        </Column>

        <Column
          :header="tr('ot.requests.requester', 'Requester')"
          style="width: 13rem; min-width: 13rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="requester-cell"
            >
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
          style="width: 15rem; min-width: 15rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="displayApproval(data).label"
              :class="displayApprovalTagClass(data)"
            />
          </template>
        </Column>

        <Column
          :header="tr('ot.approval.requestedStaff', 'Staff')"
          style="width: 8rem; min-width: 8rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="tr('ot.requests.staffCount', `${displayStaffCount(data)} staff`, {
                count: displayStaffCount(data),
              })"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-info']"
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
            <span
              v-if="data"
              class="ot-meta-text"
            >
              {{ formatDateDMY(data.otDate) }}
            </span>
          </template>
        </Column>

        <Column
          :header="tr('ot.requests.otTime', 'OT Time')"
          style="width: 8rem; min-width: 8rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="displayPaidTime(data)"
              :class="['ot-approval-rgb-tag', 'ot-approval-tag-info']"
            />
          </template>
        </Column>

        <Column
          field="createdAt"
          :header="tr('common.createdAt', 'Created At')"
          sortable
          style="width: 12rem; min-width: 12rem"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="ot-meta-text"
            >
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
            <div
              v-if="data"
              class="ot-row-actions"
            >
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
              class="ot-expanded-content"
            >
              <div class="ot-expanded-summary">
                <span>
                  {{ tr('ot.approval.employeeCount', `${displayEmployees(data).length} employees`, {
                    count: displayEmployees(data).length,
                  }) }}
                </span>

                <span>
                  {{ tr('ot.requests.otTime', 'OT Time') }}:
                  <strong>{{ displayPaidTime(data) }}</strong>
                </span>
              </div>

              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>{{ tr('common.no', 'No') }}</div>
                  <div>{{ tr('ot.requests.employeeId', 'Employee ID') }}</div>
                  <div>{{ tr('common.name', 'Name') }}</div>
                  <div>{{ tr('nav.positions', 'Position') }}</div>
                  <div>{{ tr('ot.requests.otTime', 'OT Time') }}</div>
                  <div>{{ tr('nav.departments', 'Department') }}</div>
                </div>

                <div
                  v-for="(employee, index) in displayEmployees(data)"
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

                  <div class="cell-center cell-mono">
                    {{ employeePaidTimeOf(employee, data) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeDepartmentOf(employee) }}
                  </div>
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
          <span class="ot-dialog-icon">
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
        <Button
          :label="tr('common.cancel', 'Cancel')"
          severity="secondary"
          outlined
          :disabled="decisionDialog.loading"
          @click="closeDecision"
        />

        <Button
          :label="
            decisionIsApprove
              ? tr('ot.approval.approve', 'Approve')
              : tr('ot.approval.reject', 'Reject')
          "
          :icon="decisionIsApprove ? 'pi pi-check' : 'pi pi-times'"
          :severity="decisionIsApprove ? undefined : 'danger'"
          :loading="decisionDialog.loading"
          :class="decisionIsApprove ? 'ot-approve-button' : ''"
          @click="submitDecision"
        />
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
        <Button
          :label="tr('common.cancel', 'Cancel')"
          severity="secondary"
          outlined
          :disabled="bulkDialog.loading"
          @click="closeBulkDialog"
        />

        <Button
          :label="tr('ot.approval.approve', 'Approve')"
          icon="pi pi-check"
          :loading="bulkDialog.loading"
          class="ot-approve-button"
          @click="submitBulkApproval"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.ot-page-shell {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ot-filter-bar {
  display: grid;
  grid-template-columns: minmax(14rem, 1.4fr) minmax(11rem, 0.9fr) minmax(11rem, 0.9fr) minmax(11rem, 0.9fr) auto;
  gap: 0.75rem;
  align-items: end;
  padding: 0.85rem;
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.05), transparent 34%),
    var(--surface-card);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.ot-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.ot-field-label {
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--text-color-secondary);
  letter-spacing: 0.01em;
}

.ot-approval-filter-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 0.45rem;
  min-width: 18rem;
}

.ot-approval-action-button {
  white-space: nowrap;
}

.ot-loaded-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0.34rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(59, 130, 246, 0.18);
  background: rgba(59, 130, 246, 0.08);
  color: #2563eb;
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.ot-table-card {
  border: 1px solid var(--surface-border);
  border-radius: 20px;
  background: var(--surface-card);
  box-shadow: 0 16px 42px rgba(15, 23, 42, 0.07);
  overflow: hidden;
}

.ot-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--surface-border);
  background:
    linear-gradient(135deg, rgba(16, 185, 129, 0.06), transparent 30%),
    var(--surface-card);
}

.ot-table-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--text-color);
}

.ot-table-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ot-approval-table {
  width: 100%;
}

.ot-approval-table :deep(.p-datatable-thead > tr > th) {
  padding: 0.68rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 800;
  color: var(--text-color-secondary);
  background: var(--surface-ground);
  border-color: var(--surface-border);
  white-space: nowrap;
}

.ot-approval-table :deep(.p-datatable-tbody > tr > td) {
  padding: 0.6rem 0.75rem;
  vertical-align: middle;
  border-color: var(--surface-border);
}

.ot-approval-table :deep(.p-datatable-tbody > tr:hover) {
  background: rgba(34, 197, 94, 0.035);
}

.ot-request-no-text {
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    'Liberation Mono',
    'Courier New',
    monospace;
  font-size: 0.82rem;
  font-weight: 800;
  color: #16a34a;
  white-space: nowrap;
}

.requester-cell {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  min-width: 0;
}

.ot-main-text {
  font-size: 0.83rem;
  font-weight: 800;
  color: var(--text-color);
  line-height: 1.25;
}

.ot-sub-text {
  font-size: 0.74rem;
  font-weight: 650;
  color: var(--text-color-secondary);
  line-height: 1.2;
}

.ot-meta-text {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.ot-row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
  min-width: 0;
}

.ot-action-mini {
  min-height: 2rem;
  padding-inline: 0.65rem;
  white-space: nowrap;
}

.ot-approve-button {
  border-color: #16a34a !important;
  background: #16a34a !important;
  color: #ffffff !important;
}

.ot-approve-button:hover {
  border-color: #15803d !important;
  background: #15803d !important;
  color: #ffffff !important;
}

.ot-muted-action {
  color: var(--text-color-secondary);
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.ot-approval-rgb-tag {
  border: 1px solid transparent;
  box-shadow: none;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.approval-display-tag {
  max-width: 13rem;
}

.approval-display-tag :deep(.p-tag-value) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-tag-approved {
  border-color: rgba(34, 197, 94, 0.28) !important;
  background: rgba(34, 197, 94, 0.12) !important;
  color: #15803d !important;
}

.ot-approval-tag-rejected {
  border-color: rgba(239, 68, 68, 0.28) !important;
  background: rgba(239, 68, 68, 0.12) !important;
  color: #b91c1c !important;
}

.ot-approval-tag-pending {
  border-color: rgba(245, 158, 11, 0.3) !important;
  background: rgba(245, 158, 11, 0.14) !important;
  color: #b45309 !important;
}

.ot-approval-tag-info {
  border-color: rgba(59, 130, 246, 0.25) !important;
  background: rgba(59, 130, 246, 0.11) !important;
  color: #1d4ed8 !important;
}

.ot-approval-tag-muted {
  border-color: rgba(100, 116, 139, 0.24) !important;
  background: rgba(100, 116, 139, 0.1) !important;
  color: #475569 !important;
}

.ot-expanded-box {
  padding: 0.75rem;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.04), transparent 34%),
    var(--surface-ground);
  border-radius: 14px;
}

.ot-expanded-content {
  overflow-x: auto;
}

.ot-expanded-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-color-secondary);
}

.ot-expanded-summary strong {
  color: var(--text-color);
}

.ot-expanded-responsive-table {
  display: flex;
  flex-direction: column;
  min-width: 720px;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface-card);
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns: 4rem 9rem minmax(12rem, 1.2fr) minmax(10rem, 1fr) 8rem minmax(10rem, 1fr);
  align-items: center;
  min-height: 2.65rem;
  border-bottom: 1px solid var(--surface-border);
}

.ot-expanded-grid-row:last-child {
  border-bottom: 0;
}

.ot-expanded-grid-row > div {
  padding: 0.55rem 0.65rem;
  font-size: 0.78rem;
  border-right: 1px solid var(--surface-border);
}

.ot-expanded-grid-row > div:last-child {
  border-right: 0;
}

.ot-expanded-grid-row.is-head {
  min-height: 2.4rem;
  background: var(--surface-ground);
}

.ot-expanded-grid-row.is-head > div {
  font-size: 0.72rem;
  font-weight: 850;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.cell-center {
  text-align: center;
}

.cell-mono {
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    'Liberation Mono',
    'Courier New',
    monospace;
  font-weight: 800;
}

.cell-strong {
  font-weight: 800;
  color: var(--text-color);
}

.cell-wrap {
  overflow-wrap: anywhere;
}

.ot-expanded-empty {
  padding: 0.9rem;
  border: 1px dashed var(--surface-border);
  border-radius: 14px;
  color: var(--text-color-secondary);
  font-size: 0.82rem;
  text-align: center;
  background: var(--surface-card);
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
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  font-size: 1.25rem;
}

.ot-empty-title {
  font-size: 0.95rem;
  font-weight: 850;
  color: var(--text-color);
}

.ot-empty-text {
  font-size: 0.82rem;
  text-align: center;
}

.ot-dialog-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ot-dialog-icon {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
  color: #16a34a;
  font-size: 1rem;
}

.ot-dialog-title {
  font-size: 1rem;
  font-weight: 850;
  color: var(--text-color);
}

.ot-dialog-subtitle {
  margin-top: 0.1rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-color-secondary);
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
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.65rem;
  border: 1px solid var(--surface-border);
  border-radius: 14px;
  background: var(--surface-ground);
}

.ot-dialog-summary span {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ot-dialog-summary strong {
  font-size: 0.82rem;
  font-weight: 850;
  color: var(--text-color);
  overflow-wrap: anywhere;
}

.ot-dialog-label {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--text-color-secondary);
}

@media (max-width: 1100px) {
  .ot-filter-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-approval-filter-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
    min-width: 0;
  }
}

@media (max-width: 760px) {
  .ot-table-toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
  }

  .ot-row-actions {
    position: sticky;
    right: 0;
    z-index: 2;
    padding: 0.25rem;
    border-radius: 12px;
    background: var(--surface-card);
    box-shadow: -8px 0 18px rgba(15, 23, 42, 0.08);
  }

  .ot-dialog-summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .ot-filter-bar {
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }

  .ot-approval-filter-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-approval-action-button,
  .ot-loaded-badge {
    width: 100%;
    justify-content: center;
  }

  .ot-table-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .ot-table-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .ot-expanded-box {
    padding: 0.5rem;
  }
}
</style>