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

const selectedApprovedCount = computed(
  () => decisionDialog.selectedApprovedEmployeeIds.length,
)

const removedCount = computed(() =>
  Math.max(
    0,
    decisionEmployees.value.length -
      decisionDialog.selectedApprovedEmployeeIds.length,
  ),
)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
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

function requesterStatusClass(value) {
  return `ot-requester-${normalizeClassKey(value || 'unknown')}`
}

function dayTypeClass(value) {
  return `ot-day-${normalizeClassKey(value || 'unknown')}`
}

function timingModeClass(value) {
  return `ot-timing-${normalizeClassKey(value || 'unknown')}`
}

function modeClass(row) {
  return isLegacyManualMode(row) ? 'ot-mode-legacy-manual' : 'ot-mode-shift-option'
}

function getTimingMode(row) {
  return String(
    row?.shiftOtOptionTimingMode ||
      row?.timingMode ||
      row?.otTimingMode ||
      row?.shiftOtOption?.timingMode ||
      '',
  )
    .trim()
    .toUpperCase()
}

function timingModeLabel(value) {
  const normalized = String(value || '').trim().toUpperCase()

  if (normalized === 'FIXED_TIME') return 'Fixed Time'
  if (normalized === 'AFTER_SHIFT_END') return 'After Shift End'

  return 'Timing N/A'
}

function timingModeSeverity(value) {
  const normalized = String(value || '').trim().toUpperCase()

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
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function statusSeverity(value) {
  const normalized = String(value || '').toUpperCase()

  if (normalized === 'APPROVED') return 'success'
  if (normalized === 'REJECTED') return 'danger'
  if (normalized === 'REQUESTER_DISAGREED') return 'danger'
  if (normalized === 'PENDING_REQUESTER_CONFIRMATION') return 'info'
  if (normalized === 'CANCELLED') return 'contrast'
  if (normalized === 'PENDING') return 'warning'

  return 'secondary'
}

function modeSeverity(value) {
  return value === 'SHIFT_OPTION' ? 'info' : 'contrast'
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
  const current = Number(row?.currentApprovalStep || 1)
  const total = Array.isArray(row?.approvalSteps)
    ? row.approvalSteps.length
    : Number(row?.approvalStepCount || 0)

  return `Step ${current} / ${total || 0}`
}

function canDecide(row) {
  return String(row?.status || '').toUpperCase() === 'PENDING'
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

function toggleApprovedEmployee(employee) {
  if (decisionDialog.action !== 'APPROVE') return

  const id = employeeIdOf(employee)

  if (!id) return

  if (decisionDialog.selectedApprovedEmployeeIds.includes(id)) {
    if (decisionDialog.selectedApprovedEmployeeIds.length === 1) return

    decisionDialog.selectedApprovedEmployeeIds =
      decisionDialog.selectedApprovedEmployeeIds.filter((item) => item !== id)

    return
  }

  decisionDialog.selectedApprovedEmployeeIds = [
    ...decisionDialog.selectedApprovedEmployeeIds,
    id,
  ]
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
    const total = Number(
      payload?.pagination?.total ||
        payload?.pagination?.totalRecords ||
        0,
    )

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

  if (
    decisionDialog.action === 'REJECT' &&
    !String(decisionDialog.remark || '').trim()
  ) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please enter rejection remark.',
      life: 2500,
    })
    return
  }

  if (
    decisionDialog.action === 'APPROVE' &&
    !decisionDialog.selectedApprovedEmployeeIds.length
  ) {
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
          <IconField class="w-full xl:w-[320px] xl:shrink-0">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              placeholder="Search request no, requester, employee, shift, option, reason"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[180px] xl:shrink-0">
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

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateFrom"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date From"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateTo"
              dateFormat="yy-mm-dd"
              showIcon
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
        tableStyle="min-width: 116rem"
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
            No OT approval records found.
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
          header="Requested"
          style="min-width: 8rem"
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
          style="min-width: 9rem"
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
          field="status"
          header="Status"
          sortable
          style="min-width: 16rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="flex flex-nowrap items-center gap-1.5"
            >
              <Tag
                :value="data.status || '-'"
                :severity="statusSeverity(data.status)"
                class="ot-status-tag"
                :class="statusClass(data.status)"
              />

              <Tag
                v-if="data.requesterConfirmationStatus && data.requesterConfirmationStatus !== 'NOT_REQUIRED'"
                :value="`Requester: ${data.requesterConfirmationStatus}`"
                severity="contrast"
                class="ot-status-tag"
                :class="requesterStatusClass(data.requesterConfirmationStatus)"
              />
            </div>
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
          style="width: 15rem; min-width: 15rem"
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
      :style="{ width: '64rem', maxWidth: '96vw' }"
      :header="decisionDialog.action === 'APPROVE' ? 'Approve / Adjust OT Request' : 'Reject OT Request'"
    >
      <div class="space-y-4">
        <div
          v-if="decisionDialog.row"
          class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-3 text-sm"
        >
          <div class="font-medium text-[color:var(--ot-text)]">
            {{ decisionDialog.row.requestNo }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Request owner: {{ formatRequester(decisionDialog.row).name }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            OT date: {{ decisionDialog.row.otDate || '-' }} • {{ formatTimeRange(decisionDialog.row) }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Mode: {{ requestModeLabel(decisionDialog.row) }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            OT option: {{ formatOtOptionLabel(decisionDialog.row) }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Timing mode: {{ timingModeLabel(getTimingMode(decisionDialog.row)) }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Requested: {{ formatRequestedMinutes(decisionDialog.row) }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Hours: {{ formatHours(decisionDialog.row) }}
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
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
              v-if="decisionDialog.action === 'APPROVE'"
              :value="`Selected ${selectedApprovedCount} staff`"
              severity="success"
              class="ot-status-tag ot-status-approved"
            />

            <Tag
              v-if="decisionDialog.action === 'APPROVE' && removedCount > 0"
              :value="`Removed ${removedCount}`"
              severity="warning"
              class="ot-status-tag ot-status-pending"
            />
          </div>
        </div>

        <template v-if="decisionDialog.action === 'APPROVE'">
          <div class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div class="text-sm font-medium text-[color:var(--ot-text)]">
                  Select final approved employees
                </div>

                <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                  Remove anyone who should not continue to final approved OT staff.
                </div>
              </div>

              <Button
                label="Select All"
                icon="pi pi-check-square"
                size="small"
                severity="secondary"
                outlined
                @click="selectAllEmployees"
              />
            </div>

            <div
              v-if="decisionEmployees.length"
              class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              <button
                v-for="employee in decisionEmployees"
                :key="employeeIdOf(employee)"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left transition"
                :class="
                  isEmployeeSelected(employee)
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                    : 'border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] hover:border-primary/40'
                "
                @click="toggleApprovedEmployee(employee)"
              >
                <div class="flex items-start gap-3">
                  <div
                    class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border"
                    :class="
                      isEmployeeSelected(employee)
                        ? 'border-primary bg-primary text-white'
                        : 'border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] text-transparent'
                    "
                  >
                    <i class="pi pi-check text-[12px]" />
                  </div>

                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-[color:var(--ot-text)]">
                      {{ employee.employeeName || '-' }}
                    </div>

                    <div class="mt-1 text-xs text-[color:var(--ot-text-muted)]">
                      {{ employee.employeeCode || '-' }}
                    </div>

                    <div class="mt-2 text-xs text-[color:var(--ot-text-muted)]">
                      {{ employee.departmentName || '-' }} · {{ employee.positionName || '-' }}
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div
              v-else
              class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-6 text-center text-sm text-[color:var(--ot-text-muted)]"
            >
              No employees available for this approval.
            </div>
          </div>
        </template>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Remark
            <span
              v-if="decisionDialog.action === 'REJECT'"
              class="text-red-500"
            >*</span>
          </label>

          <Textarea
            v-model.trim="decisionDialog.remark"
            rows="4"
            autoResize
            class="w-full"
            :placeholder="
              decisionDialog.action === 'APPROVE'
                ? 'Optional remark. If you changed the staff list, explain why.'
                : 'Please enter rejection reason'
            "
          />
        </div>

        <div class="flex justify-end gap-2">
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

/* Compact one-row action buttons */
.action-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.35rem;
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

/* Status colors */
:deep(.p-tag.ot-status-pending),
:deep(.p-tag.ot-status-pending-requester-confirmation) {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #f59e0b !important;
}

:deep(.p-tag.ot-status-approved) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-status-rejected),
:deep(.p-tag.ot-status-requester-disagreed) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-status-cancelled) {
  background: #e5e7eb !important;
  color: #374151 !important;
  border-color: #9ca3af !important;
}

/* Requester confirmation colors */
:deep(.p-tag.ot-requester-agreed),
:deep(.p-tag.ot-requester-confirmed) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-requester-disagreed),
:deep(.p-tag.ot-requester-rejected) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-requester-pending),
:deep(.p-tag.ot-requester-pending-confirmation) {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #f59e0b !important;
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

/* Dark mode status colors */
:global(.dark) :deep(.p-tag.ot-status-pending),
:global(.dark) :deep(.p-tag.ot-status-pending-requester-confirmation) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-approved),
:global(.dark) :deep(.p-tag.ot-requester-agreed),
:global(.dark) :deep(.p-tag.ot-requester-confirmed) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-rejected),
:global(.dark) :deep(.p-tag.ot-status-requester-disagreed),
:global(.dark) :deep(.p-tag.ot-requester-disagreed),
:global(.dark) :deep(.p-tag.ot-requester-rejected) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-cancelled) {
  background: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-requester-pending),
:global(.dark) :deep(.p-tag.ot-requester-pending-confirmation) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

/* Dark mode day type colors */
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

/* Dark mode mode/timing/count colors */
:global(.dark) :deep(.p-tag.ot-mode-shift-option) {
  background: rgba(59, 130, 246, 0.18) !important;
  color: #93c5fd !important;
  border-color: rgba(59, 130, 246, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-mode-legacy-manual) {
  background: rgba(168, 85, 247, 0.18) !important;
  color: #d8b4fe !important;
  border-color: rgba(168, 85, 247, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-timing-fixed-time) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-timing-after-shift-end) {
  background: rgba(14, 165, 233, 0.18) !important;
  color: #7dd3fc !important;
  border-color: rgba(14, 165, 233, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-timing-unknown) {
  background: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
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
</style>