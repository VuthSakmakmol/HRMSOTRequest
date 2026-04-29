<!-- frontend/src/modules/ot/views/OTRequestListView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestListView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { useAuthStore } from '@/modules/auth/auth.store'
import {
  getOTRequests,
  exportOTRequestsExcel,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

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
  sortField: 'createdAt',
  sortOrder: -1,
})

const canCreateRequest = computed(() => auth.hasAnyPermission(['OT_REQUEST_CREATE']))
const canUpdateRequest = computed(() => auth.hasAnyPermission(['OT_REQUEST_UPDATE']))
const canVerifyAttendance = computed(() => auth.hasAnyPermission(['ATTENDANCE_VERIFY']))

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Pending Confirmation', value: 'PENDING_REQUESTER_CONFIRMATION' },
]

const dayTypeOptions = [
  { label: 'All Day Types', value: '' },
  { label: 'Working Day', value: 'WORKING_DAY' },
  { label: 'Sunday', value: 'SUNDAY' },
  { label: 'Holiday', value: 'HOLIDAY' },
]

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalRequests.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRequests.value > PAGE_SIZE)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function normalizeClassKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function dayTypeClass(value) {
  const key = normalizeClassKey(value || 'unknown')
  return `ot-day-${key}`
}

function statusClass(value) {
  const key = normalizeClassKey(value || 'unknown')
  return `ot-status-${key}`
}

function dayTypeSeverity(value) {
  if (value === 'HOLIDAY') return 'danger'
  if (value === 'SUNDAY') return 'warning'
  if (value === 'WORKING_DAY') return 'success'
  return 'secondary'
}

function statusSeverity(value) {
  if (value === 'APPROVED') return 'success'
  if (value === 'REJECTED') return 'danger'
  if (value === 'CANCELLED') return 'contrast'
  if (value === 'PENDING') return 'warning'
  if (value === 'PENDING_REQUESTER_CONFIRMATION') return 'warning'
  if (value === 'DRAFT') return 'info'
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

function formatTimeRange(row) {
  const start = String(row?.startTime || '').trim()
  const end = String(row?.endTime || '').trim()

  if (!start && !end) return '-'

  return [start, end].filter(Boolean).join(' - ')
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
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList

  return []
}

function getEmployeeCount(row) {
  const explicitCount = Number(row?.employeeCount || row?.totalEmployees || 0)

  if (explicitCount > 0) return explicitCount

  return getTargetEmployees(row).length
}

function canEdit(row) {
  return canUpdateRequest.value && !!row?.canEdit
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTRequests(buildQuery(page))
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
        'Failed to load OT requests',
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

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
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

function goCreate() {
  if (!canCreateRequest.value) return

  router.push('/ot/requests/create')
}

function goDetail(id) {
  if (!id) return

  router.push(`/ot/requests/${id}`)
}

function goEdit(id) {
  if (!id || !canUpdateRequest.value) return

  router.push(`/ot/requests/${id}/edit`)
}

function goVerifyAttendance(id) {
  if (!id || !canVerifyAttendance.value) return

  router.push(`/attendance/ot-verification/${id}`)
}

function getExportFilenameFromHeaders(headers = {}) {
  const disposition =
    headers?.['content-disposition'] || headers?.['Content-Disposition'] || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)

  if (!match?.[1]) return 'ot-requests.xlsx'

  return decodeURIComponent(match[1]).replace(/[/\\?%*:|"<>]/g, '_')
}

async function onExportExcel() {
  if (exporting.value) return

  exporting.value = true

  try {
    const res = await exportOTRequestsExcel(buildExportQuery())

    const blob = new Blob(
      [
        res?.data instanceof Blob
          ? res.data
          : new Uint8Array(res?.data || []),
      ],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    )

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getExportFilenameFromHeaders(res?.headers || '')

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Export ready',
      detail: 'Excel file downloaded successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to export Excel file',
      life: 3000,
    })
  } finally {
    exporting.value = false
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
      <div class="min-w-0">
        <h1 class="text-xl font-medium text-[color:var(--ot-text)]">
          OT Requests
        </h1>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>

          <div class="mt-1 text-lg font-medium leading-none text-[color:var(--ot-text)]">
            {{ totalRequests }}
          </div>
        </div>

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
          v-if="canCreateRequest"
          label="New OT Request"
          icon="pi pi-plus"
          size="small"
          @click="goCreate"
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
              placeholder="Search request no, requester, employee, department, reason"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[170px] xl:shrink-0">
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
        tableStyle="min-width: 98rem"
        class="ot-request-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 72,
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
            No OT requests found.
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
          header="Employees"
          style="min-width: 9rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="`${getEmployeeCount(data)} staff`"
              severity="info"
              class="ot-status-tag"
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
          header="Time"
          style="min-width: 11rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column
          field="breakMinutes"
          header="Break"
          style="min-width: 8rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ data.breakMinutes ?? 0 }} min</span>
          </template>
        </Column>

        <Column
          field="totalHours"
          header="Hours"
          sortable
          style="min-width: 8rem"
        >
          <template #body="{ data }">
            <span v-if="data">{{ data.totalHours ?? '-' }}</span>
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
          style="min-width: 11rem"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.status || '-'"
              :severity="statusSeverity(data.status)"
              class="ot-status-tag"
              :class="statusClass(data.status)"
            />
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
          style="width: 20rem; min-width: 20rem"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="flex flex-wrap gap-2"
            >
              <Button
                v-if="canVerifyAttendance"
                label="Verify"
                icon="pi pi-check-square"
                size="small"
                severity="success"
                outlined
                @click="goVerifyAttendance(data._id || data.id)"
              />

              <Button
                label="View"
                icon="pi pi-eye"
                size="small"
                outlined
                @click="goDetail(data._id || data.id)"
              />

              <Button
                v-if="canEdit(data)"
                label="Edit"
                icon="pi pi-pencil"
                size="small"
                severity="warning"
                outlined
                @click="goEdit(data._id || data.id)"
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
  </div>
</template>

<style scoped>
:deep(.ot-request-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.ot-request-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  height: 72px !important;
  vertical-align: middle !important;
}

:deep(.ot-request-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
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

:deep(.p-tag.ot-status-rejected) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-status-cancelled) {
  background: #e5e7eb !important;
  color: #374151 !important;
  border-color: #9ca3af !important;
}

:deep(.p-tag.ot-status-draft) {
  background: #dbeafe !important;
  color: #1e40af !important;
  border-color: #3b82f6 !important;
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

/* Dark mode status colors */
:global(.dark) :deep(.p-tag.ot-status-pending),
:global(.dark) :deep(.p-tag.ot-status-pending-requester-confirmation) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-approved) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-rejected) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-cancelled) {
  background: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-draft) {
  background: rgba(59, 130, 246, 0.18) !important;
  color: #93c5fd !important;
  border-color: rgba(59, 130, 246, 0.45) !important;
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
</style>