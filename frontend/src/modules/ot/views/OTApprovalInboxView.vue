<!-- frontend/src/modules/ot/views/OTApprovalInboxView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTApprovalInboxView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
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

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const exporting = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: null,
  otDateTo: null,
  sortField: 'createdAt',
  sortOrder: -1,
})

const decisionDialog = reactive({
  visible: false,
  loading: false,
  action: 'APPROVE',
  remark: '',
  row: null,
  selectedApprovedEmployeeIds: [],
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
const selectedApprovedCount = computed(() => decisionDialog.selectedApprovedEmployeeIds.length)

const removedCount = computed(() =>
  Math.max(0, decisionEmployees.value.length - decisionDialog.selectedApprovedEmployeeIds.length),
)

const allowedDecisionEmployees = computed(() =>
  decisionEmployees.value.filter((employee) => isEmployeeSelected(employee)),
)

const removedDecisionEmployees = computed(() =>
  decisionEmployees.value.filter((employee) => !isEmployeeSelected(employee)),
)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
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

function statusClass(value) {
  return `ot-status-${normalizeClassKey(value || 'unknown')}`
}

function dayTypeClass(value) {
  return `ot-day-${normalizeClassKey(value || 'unknown')}`
}

function timingModeClass(value) {
  return `ot-timing-${normalizeClassKey(value || 'unknown')}`
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

function timingModeSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'FIXED_TIME') return 'warning'
  if (normalized === 'AFTER_SHIFT_END') return 'info'

  return 'secondary'
}

function formatDateYMD(value) {
  if (!value) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
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
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
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

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
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

function formatShiftLabel(row) {
  const code = String(row?.shiftCode || '').trim()
  const name = String(row?.shiftName || '').trim()

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  return '-'
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
  const explicitCount = Number(
    row?.employeeCount || row?.approvedEmployeeCount || row?.totalEmployees || 0,
  )

  if (explicitCount > 0) return explicitCount

  return getTargetEmployees(row).length
}

function currentStepLabel(row) {
  const current = Number(row?.currentApprovalStep || row?.currentStep || 1)
  const total = Array.isArray(row?.approvalSteps)
    ? row.approvalSteps.length
    : Number(row?.approvalStepCount || row?.totalApprovalSteps || 0)

  return `Step ${current} / ${total || 0}`
}

function canDecide(row) {
  return row?.canDecide === true
}

function openView(row) {
  const id = String(row?._id || row?.id || '').trim()

  if (!id) return

  router.push(`/ot/requests/${id}`)
}

function resetDecisionDialog() {
  decisionDialog.visible = false
  decisionDialog.loading = false
  decisionDialog.action = 'APPROVE'
  decisionDialog.remark = ''
  decisionDialog.row = null
  decisionDialog.selectedApprovedEmployeeIds = []
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

function employeeLineOf(employee) {
  const code = String(employee?.lineCode || employee?.line?.code || '').trim()
  const name = String(employee?.lineName || employee?.line?.name || '').trim()

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  return ''
}

function openDecision(row, action) {
  if (!canDecide(row)) return

  const employees = getTargetEmployees(row)
  const ids = employees.map(employeeIdOf).filter(Boolean)

  decisionDialog.visible = true
  decisionDialog.loading = false
  decisionDialog.action = action
  decisionDialog.remark = ''
  decisionDialog.row = row
  decisionDialog.selectedApprovedEmployeeIds = action === 'APPROVE' ? ids : []
}

function closeDecision() {
  if (decisionDialog.loading) return

  resetDecisionDialog()
}

function isEmployeeSelected(employee) {
  const id = employeeIdOf(employee)

  return decisionDialog.selectedApprovedEmployeeIds.includes(id)
}

function moveEmployeeToAllowed(employee) {
  if (decisionDialog.action !== 'APPROVE') return

  const id = employeeIdOf(employee)
  if (!id) return

  if (decisionDialog.selectedApprovedEmployeeIds.includes(id)) return

  decisionDialog.selectedApprovedEmployeeIds = [
    ...decisionDialog.selectedApprovedEmployeeIds,
    id,
  ]
}

function moveEmployeeToRemoved(employee) {
  if (decisionDialog.action !== 'APPROVE') return

  const id = employeeIdOf(employee)
  if (!id) return

  if (!decisionDialog.selectedApprovedEmployeeIds.includes(id)) return

  if (decisionDialog.selectedApprovedEmployeeIds.length === 1) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please keep at least 1 approved employee.',
      life: 2500,
    })
    return
  }

  decisionDialog.selectedApprovedEmployeeIds =
    decisionDialog.selectedApprovedEmployeeIds.filter((item) => item !== id)
}

function toggleApprovedEmployee(employee) {
  if (decisionDialog.action !== 'APPROVE') return

  if (isEmployeeSelected(employee)) {
    moveEmployeeToRemoved(employee)
    return
  }

  moveEmployeeToAllowed(employee)
}

function selectAllEmployees() {
  decisionDialog.selectedApprovedEmployeeIds = decisionEmployees.value
    .map(employeeIdOf)
    .filter(Boolean)
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
    const items = normalizeItems(payload)
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

async function reloadFirstPage({ keepVisible = true } = {}) {
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
    reloadFirstPage({ keepVisible: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function onDayTypeChange() {
  reloadFirstPage({ keepVisible: true })
}

function onDateChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = null
  filters.otDateTo = null
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  const fieldMap = {
    requestNo: 'requestNo',
    otDate: 'otDate',
    totalHours: 'totalHours',
    dayType: 'dayType',
    status: 'status',
    createdAt: 'createdAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'createdAt'
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

  if (!row?._id && !row?.id) return

  if (decisionDialog.action === 'REJECT' && !String(decisionDialog.remark || '').trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please enter rejection remark.',
      life: 2500,
    })
    return
  }

  if (decisionDialog.action === 'APPROVE' && !decisionDialog.selectedApprovedEmployeeIds.length) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please keep at least 1 approved employee.',
      life: 2500,
    })
    return
  }

  try {
    decisionDialog.loading = true

    await decideOTRequest(row._id || row.id, {
      action: decisionDialog.action,
      approvedEmployeeIds:
        decisionDialog.action === 'APPROVE'
          ? decisionDialog.selectedApprovedEmployeeIds
          : [],
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
    await reloadFirstPage({ keepVisible: false })
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

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
      </div>

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
              dateFormat="yy-mm-dd"
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
              dateFormat="yy-mm-dd"
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
        :value="rows"
        lazy
        removableSort
        scrollable
        scrollHeight="500px"
        :sortField="filters.sortField"
        :sortOrder="filters.sortOrder"
        tableStyle="min-width: 112rem"
        class="ot-approval-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 78,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
        @sort="onSort"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No OT approval requests found.
          </div>
        </template>

        <Column
          field="requestNo"
          header="Request No"
          sortable
          style="min-width: 10rem"
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

        <Column
          header="Request Owner"
          style="min-width: 15rem"
        >
          <template #body="{ data }">
            <div v-if="data">
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
          header="Approval Status"
          sortable
          style="min-width: 22rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="approval-status-cell"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <Tag
                  :value="data.status || '-'"
                  :severity="statusSeverity(data.status)"
                  class="ot-status-tag"
                  :class="statusClass(data.status)"
                />

                <Tag
                  :value="approvalDisplay(data).label"
                  :severity="approvalDisplaySeverity(data)"
                  class="ot-status-tag approval-display-tag"
                  :class="approvalDisplayClass(data)"
                />
              </div>

              <div
                v-if="approvalDisplay(data).subLabel"
                class="approval-sub-label"
              >
                {{ approvalDisplay(data).subLabel }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          header="Requested Staff"
          style="min-width: 9rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="`${Number(data?.requestedEmployeeCount || 0)} staff`"
              severity="secondary"
              class="ot-status-tag ot-count-requested"
            />
          </template>
        </Column>

        <Column
          header="Current Approved"
          style="min-width: 10rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="`${getEmployeeCount(data)} staff`"
              severity="info"
              class="ot-status-tag ot-count-approved"
            />
          </template>
        </Column>

        <Column
          field="otDate"
          header="OT Date"
          sortable
          style="min-width: 10rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ data.otDate || '-' }}</span>
          </template>
        </Column>

        <Column
          header="Request Window"
          style="min-width: 12rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column
          header="OT Option"
          style="min-width: 17rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="flex flex-col gap-1"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="font-medium text-[color:var(--ot-text)]">
                  {{ formatOtOptionLabel(data) }}
                </span>

                <Tag
                  v-if="!isLegacyManualMode(data)"
                  :value="timingModeLabel(getTimingMode(data))"
                  :severity="timingModeSeverity(getTimingMode(data))"
                  class="ot-status-tag"
                  :class="timingModeClass(getTimingMode(data))"
                />
              </div>

              <span
                v-if="!isLegacyManualMode(data)"
                class="text-xs text-[color:var(--ot-text-muted)]"
              >
                {{ formatShiftLabel(data) }}
              </span>
            </div>
          </template>
        </Column>

        <Column
          header="Requested"
          style="min-width: 9rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatRequestedMinutes(data) }}</span>
          </template>
        </Column>

        <Column
          field="totalHours"
          header="Hours"
          sortable
          style="min-width: 8rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatHours(data) }}</span>
          </template>
        </Column>

        <Column
          field="dayType"
          header="Day Type"
          sortable
          style="min-width: 9rem"
        >
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

        <Column
          header="Current Step"
          style="min-width: 10rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ currentStepLabel(data) }}</span>
          </template>
        </Column>

        <Column
          field="createdAt"
          header="Created At"
          sortable
          style="min-width: 14rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <Column
          header="Actions"
          style="width: 16rem; min-width: 16rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="action-row"
            >
              <Button
                label="View"
                icon="pi pi-eye"
                size="small"
                severity="secondary"
                outlined
                class="action-btn"
                @click="openView(data)"
              />

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
              {{ decisionDialog.action === 'APPROVE' ? 'Approve / Adjust OT Request' : 'Reject OT Request' }}
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

            <Tag
              v-if="decisionDialog.action === 'APPROVE'"
              :value="`${selectedApprovedCount} allowed`"
              severity="success"
              class="ot-status-tag ot-status-approved"
            />

            <Tag
              v-if="decisionDialog.action === 'APPROVE' && removedCount > 0"
              :value="`${removedCount} removed`"
              severity="warning"
              class="ot-status-tag ot-status-pending"
            />
          </div>
        </div>
      </template>

      <div class="ot-decision-body">
        <div
          v-if="decisionDialog.row"
          class="ot-decision-summary"
        >
          <div class="ot-summary-main">
            <div class="ot-summary-request-no">
              {{ decisionDialog.row.requestNo || '-' }}
            </div>

            <div class="ot-summary-owner">
              {{ formatRequester(decisionDialog.row).name }}
              <span>{{ formatRequester(decisionDialog.row).employeeNo }}</span>
            </div>
          </div>

          <div class="ot-summary-grid">
            <div class="ot-summary-item">
              <span>OT Date</span>
              <strong>{{ decisionDialog.row.otDate || '-' }}</strong>
            </div>

            <div class="ot-summary-item">
              <span>Time</span>
              <strong>{{ formatTimeRange(decisionDialog.row) }}</strong>
            </div>

            <div class="ot-summary-item">
              <span>Mode</span>
              <strong>{{ requestModeLabel(decisionDialog.row) }}</strong>
            </div>

            <div class="ot-summary-item">
              <span>OT Option</span>
              <strong>{{ formatOtOptionLabel(decisionDialog.row) }}</strong>
            </div>

            <div class="ot-summary-item">
              <span>Timing</span>
              <strong>{{ timingModeLabel(getTimingMode(decisionDialog.row)) }}</strong>
            </div>

            <div class="ot-summary-item">
              <span>Requested</span>
              <strong>{{ formatRequestedMinutes(decisionDialog.row) }}</strong>
            </div>
          </div>

          <div class="ot-summary-tags">
            <Tag
              :value="`Requested ${Number(decisionDialog.row?.requestedEmployeeCount || 0)} staff`"
              severity="secondary"
              class="ot-status-tag ot-count-requested"
            />

            <Tag
              :value="`Current approved ${decisionEmployees.length} staff`"
              severity="info"
              class="ot-status-tag ot-count-approved"
            />

            <Tag
              :value="`${formatHours(decisionDialog.row)} hours`"
              severity="secondary"
              class="ot-status-tag"
            />
          </div>
        </div>

        <template v-if="decisionDialog.action === 'APPROVE'">
          <div class="ot-adjust-toolbar">
            <div>
              <div class="ot-adjust-title">
                Adjust final approved employees
              </div>

              <div class="ot-adjust-help">
                Move employees between allowed and removed before submitting approval.
              </div>
            </div>

            <Button
              label="Allow All"
              icon="pi pi-check-square"
              size="small"
              severity="secondary"
              outlined
              :disabled="decisionDialog.loading || !removedDecisionEmployees.length"
              @click="selectAllEmployees"
            />
          </div>

          <div class="ot-adjust-split">
            <section class="ot-adjust-panel is-allowed">
              <div class="ot-adjust-panel-header">
                <div>
                  <div class="ot-panel-title">
                    <i class="pi pi-check-circle" />
                    <span>Allowed staff</span>
                  </div>

                  <p>These employees will continue for OT approval.</p>
                </div>

                <Tag
                  :value="`${allowedDecisionEmployees.length}`"
                  severity="success"
                  class="ot-status-tag ot-status-approved"
                />
              </div>

              <div
                v-if="allowedDecisionEmployees.length"
                class="ot-adjust-card-grid"
              >
                <button
                  v-for="employee in allowedDecisionEmployees"
                  :key="employeeIdOf(employee)"
                  type="button"
                  class="ot-adjust-card is-allowed"
                  :disabled="decisionDialog.loading"
                  @click="moveEmployeeToRemoved(employee)"
                >
                  <span class="ot-adjust-card-icon">
                    <i class="pi pi-check" />
                  </span>

                  <span class="ot-adjust-card-main">
                    <strong>{{ employeeNameOf(employee) }}</strong>
                    <em>{{ employeeCodeOf(employee) }}</em>
                  </span>

                  <span class="ot-adjust-card-meta">
                    {{ employeePositionOf(employee) }}
                  </span>

                  <span class="ot-adjust-card-meta">
                    {{ employeeDepartmentOf(employee) }}
                  </span>

                  <span
                    v-if="employeeLineOf(employee)"
                    class="ot-adjust-card-meta"
                  >
                    {{ employeeLineOf(employee) }}
                  </span>

                  <span class="ot-adjust-card-action">
                    Click to remove
                  </span>
                </button>
              </div>

              <div
                v-else
                class="ot-adjust-empty"
              >
                No allowed employees.
              </div>
            </section>

            <section class="ot-adjust-panel is-removed">
              <div class="ot-adjust-panel-header">
                <div>
                  <div class="ot-panel-title">
                    <i class="pi pi-ban" />
                    <span>Not allowed / removed</span>
                  </div>

                  <p>These employees will be removed from approved OT staff.</p>
                </div>

                <Tag
                  :value="`${removedDecisionEmployees.length}`"
                  severity="warning"
                  class="ot-status-tag ot-status-pending"
                />
              </div>

              <div
                v-if="removedDecisionEmployees.length"
                class="ot-adjust-card-grid"
              >
                <button
                  v-for="employee in removedDecisionEmployees"
                  :key="employeeIdOf(employee)"
                  type="button"
                  class="ot-adjust-card is-removed"
                  :disabled="decisionDialog.loading"
                  @click="moveEmployeeToAllowed(employee)"
                >
                  <span class="ot-adjust-card-icon">
                    <i class="pi pi-times" />
                  </span>

                  <span class="ot-adjust-card-main">
                    <strong>{{ employeeNameOf(employee) }}</strong>
                    <em>{{ employeeCodeOf(employee) }}</em>
                  </span>

                  <span class="ot-adjust-card-meta">
                    {{ employeePositionOf(employee) }}
                  </span>

                  <span class="ot-adjust-card-meta">
                    {{ employeeDepartmentOf(employee) }}
                  </span>

                  <span
                    v-if="employeeLineOf(employee)"
                    class="ot-adjust-card-meta"
                  >
                    {{ employeeLineOf(employee) }}
                  </span>

                  <span class="ot-adjust-card-action">
                    Click to allow
                  </span>
                </button>
              </div>

              <div
                v-else
                class="ot-adjust-empty"
              >
                No removed employees.
              </div>
            </section>
          </div>
        </template>

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
                ? 'Optional remark. If you changed the staff list, explain why.'
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
            :label="decisionDialog.action === 'APPROVE' ? 'Submit Approval' : 'Reject'"
            :icon="decisionDialog.action === 'APPROVE' ? 'pi pi-check' : 'pi pi-times'"
            :severity="decisionDialog.action === 'APPROVE' ? undefined : 'danger'"
            :loading="decisionDialog.loading"
            size="small"
            @click="submitDecision"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.ot-approval-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.ot-approval-table .p-datatable-tbody > tr > td) {
  padding: 0.58rem 0.75rem !important;
  height: 78px !important;
  vertical-align: middle !important;
}

:deep(.ot-approval-table .p-tag.ot-status-tag),
:deep(.p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
}

.action-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
}

.approval-status-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.approval-sub-label {
  color: var(--ot-text-muted, #64748b);
  font-size: 0.72rem;
  font-weight: 500;
}

:deep(.p-tag.approval-display-tag) {
  max-width: 15rem;
}

:deep(.p-tag.approval-display-tag .p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.action-btn.p-button) {
  min-height: 1.9rem !important;
  padding: 0.26rem 0.48rem !important;
  font-size: 0.72rem !important;
  border-radius: 0.55rem !important;
}

:deep(.action-btn .p-button-label) {
  font-weight: 500 !important;
}

:deep(.action-btn .p-button-icon) {
  font-size: 0.72rem !important;
}

/* Decision dialog */
:deep(.ot-decision-dialog .p-dialog-header) {
  border-bottom: 1px solid var(--ot-border);
  padding: 0.9rem 1rem !important;
}

:deep(.ot-decision-dialog .p-dialog-content) {
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

/* Mode colors */
:deep(.p-tag.ot-mode-shift-option) {
  background: #dbeafe !important;
  color: #1e40af !important;
  border-color: #3b82f6 !important;
}

:deep(.p-tag.ot-mode-legacy-manual) {
  background: #f3e8ff !important;
  color: #6b21a8 !important;
  border-color: #a855f7 !important;
}

/* Timing mode colors */
:deep(.p-tag.ot-timing-fixed-time) {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #f59e0b !important;
}

:deep(.p-tag.ot-timing-after-shift-end) {
  background: #e0f2fe !important;
  color: #075985 !important;
  border-color: #38bdf8 !important;
}

:deep(.p-tag.ot-timing-unknown) {
  background: #e5e7eb !important;
  color: #374151 !important;
  border-color: #9ca3af !important;
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

:global(.dark) .ot-adjust-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
}

@media (max-width: 1200px) {
  .ot-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .ot-decision-header,
  .ot-summary-main,
  .ot-adjust-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-decision-header-tags {
    justify-content: flex-start;
  }

  .ot-summary-owner {
    text-align: left;
  }

  .ot-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ot-adjust-split {
    grid-template-columns: 1fr;
  }

  .ot-adjust-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-height: none;
  }
}

@media (max-width: 520px) {
  .ot-summary-grid,
  .ot-adjust-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>