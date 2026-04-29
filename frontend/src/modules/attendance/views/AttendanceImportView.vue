<!-- frontend/src/modules/attendance/views/AttendanceImportView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { useAuthStore } from '@/modules/auth/auth.store'
import AttendanceImportDialog from '@/modules/attendance/components/AttendanceImportDialog.vue'
import {
  getAttendanceImportById,
  getAttendanceImports,
} from '@/modules/attendance/attendance.api'

const toast = useToast()
const auth = useAuthStore()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)

const detailLoading = ref(false)
const importDialogVisible = ref(false)
const detailVisible = ref(false)

const selectedImportDetail = ref(null)
const latestImportResult = ref(null)

const filters = reactive({
  search: '',
  status: '',
  periodFrom: null,
  periodTo: null,
  sortField: 'createdAt',
  sortOrder: -1,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Partial Success', value: 'PARTIAL_SUCCESS' },
  { label: 'Failed', value: 'FAILED' },
]

const totalImports = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalImports.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalImports.value > PAGE_SIZE)

const canImportAttendance = computed(() => {
  if (auth.user?.isRootAdmin || auth.isRootAdmin) return true
  return auth.hasAnyPermission?.(['ATTENDANCE_IMPORT']) ?? false
})

const latestImportInfo = computed(() => {
  return (
    latestImportResult.value?.import ||
    latestImportResult.value?.item ||
    latestImportResult.value ||
    null
  )
})

const latestFailedRowsPreview = computed(() => {
  const rows =
    latestImportResult.value?.failedRows ||
    latestImportResult.value?.failedRowPreview ||
    latestImportResult.value?.errors ||
    []

  return Array.isArray(rows) ? rows.slice(0, 8) : []
})

const detailImport = computed(() => {
  return (
    selectedImportDetail.value?.import ||
    selectedImportDetail.value?.item ||
    selectedImportDetail.value ||
    null
  )
})

const detailFailedRows = computed(() => {
  const rows =
    selectedImportDetail.value?.failedRows ||
    selectedImportDetail.value?.failedRowPreview ||
    selectedImportDetail.value?.errors ||
    []

  return Array.isArray(rows) ? rows : []
})

const detailRecords = computed(() => {
  const rows =
    selectedImportDetail.value?.records ||
    selectedImportDetail.value?.items ||
    selectedImportDetail.value?.attendanceRecords ||
    []

  return Array.isArray(rows) ? rows : []
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function formatDateYMD(value) {
  if (!value) return undefined

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

function formatDateTime(value) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value)
  }
}

function formatPeriod(row) {
  const from = String(row?.periodFrom || '').trim()
  const to = String(row?.periodTo || '').trim()

  if (from && to) return `${from} → ${to}`
  if (from) return from
  if (to) return to

  return '—'
}

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  if (typeof value === 'string' && value.trim()) return value.trim()
  return '—'
}

function getImportStatusSeverity(status) {
  const normalized = String(status || '').toUpperCase()

  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'PARTIAL_SUCCESS') return 'warning'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'PROCESSING') return 'info'

  return 'secondary'
}

function formatImportNo(row) {
  return String(row?.importNo || row?.attendanceImportNo || '').trim() || '—'
}

function formatFileName(row) {
  return String(row?.fileName || '').trim() || '—'
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    periodFrom: formatDateYMD(filters.periodFrom),
    periodTo: formatDateYMD(filters.periodTo),
    sortBy: filters.sortField,
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
    const res = await getAttendanceImports(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = Number(payload?.pagination?.total || 0)

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
        'Failed to load attendance imports.',
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

function onFilterChange() {
  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  const fieldMap = {
    importNo: 'importNo',
    fileName: 'fileName',
    status: 'status',
    importedAt: 'importedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
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

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.periodFrom = null
  filters.periodTo = null
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function refresh() {
  reloadFirstPage({ keepVisible: true })
}

async function openImportDetail(row) {
  const importId = String(row?.id || row?._id || '').trim()

  if (!importId) {
    toast.add({
      severity: 'warn',
      summary: 'Missing import ID',
      detail: 'Cannot open this import detail because ID is missing.',
      life: 2500,
    })
    return
  }

  detailVisible.value = true
  detailLoading.value = true
  selectedImportDetail.value = null

  try {
    const res = await getAttendanceImportById(importId)
    selectedImportDetail.value = normalizePayload(res)
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Detail load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load attendance import detail.',
      life: 3000,
    })
  } finally {
    detailLoading.value = false
  }
}

function onImportSuccess(payload) {
  latestImportResult.value = payload
  reloadFirstPage({ keepVisible: false })
}

watch(
  () => [filters.status, filters.periodFrom, filters.periodTo],
  () => {
    onFilterChange()
  },
)

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <section
      class="overflow-hidden rounded-3xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] shadow-sm"
    >
      <div class="p-4 sm:p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold tracking-tight text-[color:var(--ot-text)]">
                Attendance Import
              </h1>
              <Tag value="Attendance" severity="info" rounded />
            </div>

            <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
              Import attendance punch data, keep batch history, and review validation results.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div
              class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] px-3 py-2 text-center"
            >
              <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
                Total
              </div>
              <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
                {{ totalImports }}
              </div>
            </div>

            <Button
              v-if="canImportAttendance"
              label="Import Attendance"
              icon="pi pi-upload"
              size="small"
              @click="importDialogVisible = true"
            />

            <Button
              label="Refresh"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              :loading="backgroundLoading"
              @click="refresh"
            />

            <Button
              label="Clear"
              icon="pi pi-filter-slash"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="latestImportInfo"
      class="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex items-center gap-2 text-base font-semibold text-[color:var(--ot-text)]">
              <i class="pi pi-check-circle text-emerald-500" />
              <span>Latest Import Result</span>
            </div>
            <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
              Latest uploaded file has been processed by the backend import engine.
            </p>
          </div>

          <Tag
            :value="latestImportInfo.status || 'UNKNOWN'"
            :severity="getImportStatusSeverity(latestImportInfo.status)"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div class="attendance-stat-box">
            <div class="attendance-stat-label">Import No</div>
            <div class="attendance-stat-value text-sm">
              {{ latestImportInfo.importNo || '—' }}
            </div>
          </div>

          <div class="attendance-stat-box">
            <div class="attendance-stat-label">Total Rows</div>
            <div class="attendance-stat-value">
              {{ Number(latestImportInfo.rowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-emerald-200 dark:border-emerald-800">
            <div class="attendance-stat-label">Success</div>
            <div class="attendance-stat-value text-emerald-600 dark:text-emerald-400">
              {{ Number(latestImportInfo.successRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-amber-200 dark:border-amber-800">
            <div class="attendance-stat-label">Failed</div>
            <div class="attendance-stat-value text-amber-600 dark:text-amber-400">
              {{ Number(latestImportInfo.failedRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-sky-200 dark:border-sky-800">
            <div class="attendance-stat-label">Duplicate</div>
            <div class="attendance-stat-value text-sky-600 dark:text-sky-400">
              {{ Number(latestImportInfo.duplicateRowCount || 0) }}
            </div>
          </div>
        </div>

        <Message
          v-if="latestImportInfo.status === 'PARTIAL_SUCCESS'"
          severity="warn"
          :closable="false"
        >
          Attendance was imported with some skipped, duplicated, or invalid rows. Please review the detail result.
        </Message>

        <div
          v-if="latestFailedRowsPreview.length"
          class="rounded-2xl border border-amber-200 bg-white/80 p-3 dark:border-amber-800 dark:bg-surface-900"
        >
          <div class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            Failed Row Preview
          </div>

          <div class="grid gap-2 md:grid-cols-2">
            <div
              v-for="row in latestFailedRowsPreview"
              :key="`${row.rawRowNo || row.rowNo || row.row || ''}-${row.message || row.reason || ''}`"
              class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-sm"
            >
              <div class="font-semibold text-[color:var(--ot-text)]">
                Row {{ row.rawRowNo || row.rowNo || row.row || '—' }}
              </div>
              <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                {{ row.message || row.reason || formatIssues(row.issues) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[360px] xl:shrink-0">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filters.search"
              placeholder="Search import no, file name, remark"
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
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="filters.periodFrom"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="Period From"
            />
          </div>

          <div class="w-full xl:w-[180px] xl:shrink-0">
            <DatePicker
              v-model="filters.periodTo"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="Period To"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              Loaded {{ summaryText }}
            </div>
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
        tableStyle="min-width: 96rem"
        class="attendance-import-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 76,
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
            No attendance imports found.
          </div>
        </template>

        <Column field="importNo" header="Import No" sortable style="min-width: 12rem">
          <template #body="{ data }">
            <span v-if="data" class="font-medium text-[color:var(--ot-text)]">
              {{ formatImportNo(data) }}
            </span>
          </template>
        </Column>

        <Column field="fileName" header="File Name" sortable style="min-width: 18rem">
          <template #body="{ data }">
            <div v-if="data" class="min-w-0">
              <div
                class="truncate font-medium text-[color:var(--ot-text)]"
                :title="formatFileName(data)"
              >
                {{ formatFileName(data) }}
              </div>
              <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                {{ data.mimeType || 'Excel file' }}
              </div>
            </div>
          </template>
        </Column>

        <Column header="Period" style="min-width: 13rem">
          <template #body="{ data }">
            <span v-if="data" class="text-sm">
              {{ formatPeriod(data) }}
            </span>
          </template>
        </Column>

        <Column header="Rows" style="min-width: 18rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-wrap gap-1.5">
              <Tag :value="`T ${Number(data.rowCount || 0)}`" severity="secondary" class="attendance-tag" />
              <Tag :value="`S ${Number(data.successRowCount || 0)}`" severity="success" class="attendance-tag" />
              <Tag :value="`F ${Number(data.failedRowCount || 0)}`" severity="warning" class="attendance-tag" />
              <Tag :value="`D ${Number(data.duplicateRowCount || 0)}`" severity="info" class="attendance-tag" />
            </div>
          </template>
        </Column>

        <Column field="status" header="Status" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.status || '-'"
              :severity="getImportStatusSeverity(data.status)"
              class="attendance-tag"
            />
          </template>
        </Column>

        <Column field="importedAt" header="Imported At" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data" class="text-sm">
              {{ formatDateTime(data.importedAt || data.createdAt) }}
            </span>
          </template>
        </Column>

        <Column field="createdAt" header="Created" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data" class="text-sm">
              {{ formatDateTime(data.createdAt) }}
            </span>
          </template>
        </Column>

        <Column header="Action" style="width: 8rem; min-width: 8rem">
          <template #body="{ data }">
            <Button
              v-if="data"
              label="View"
              icon="pi pi-eye"
              size="small"
              outlined
              @click="openImportDetail(data)"
            />
          </template>
        </Column>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </section>

    <AttendanceImportDialog
      v-model:visible="importDialogVisible"
      @success="onImportSuccess"
    />

    <Dialog
      v-model:visible="detailVisible"
      modal
      maximizable
      :style="{ width: '96vw', maxWidth: '1280px' }"
      header="Attendance Import Detail"
    >
      <div
        v-if="detailLoading"
        class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
      >
        Loading import detail...
      </div>

      <div
        v-else-if="detailImport"
        class="flex flex-col gap-4"
      >
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="attendance-metric-box">
            <div class="attendance-metric-label">Import No</div>
            <div class="attendance-metric-value">
              {{ detailImport.importNo || '—' }}
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">Status</div>
            <div class="mt-1">
              <Tag
                :value="detailImport.status || '-'"
                :severity="getImportStatusSeverity(detailImport.status)"
              />
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">Period</div>
            <div class="attendance-metric-value">
              {{ formatPeriod(detailImport) }}
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">File Name</div>
            <div class="attendance-metric-value break-all">
              {{ detailImport.fileName || '—' }}
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="attendance-stat-box">
            <div class="attendance-stat-label">Total Rows</div>
            <div class="attendance-stat-value">
              {{ Number(detailImport.rowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-emerald-200 dark:border-emerald-800">
            <div class="attendance-stat-label">Success Rows</div>
            <div class="attendance-stat-value text-emerald-600 dark:text-emerald-400">
              {{ Number(detailImport.successRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-amber-200 dark:border-amber-800">
            <div class="attendance-stat-label">Failed Rows</div>
            <div class="attendance-stat-value text-amber-600 dark:text-amber-400">
              {{ Number(detailImport.failedRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-sky-200 dark:border-sky-800">
            <div class="attendance-stat-label">Duplicate Rows</div>
            <div class="attendance-stat-value text-sky-600 dark:text-sky-400">
              {{ Number(detailImport.duplicateRowCount || 0) }}
            </div>
          </div>
        </div>

        <div
          v-if="detailImport.remark"
          class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] p-4"
        >
          <div class="mb-1 text-sm font-semibold text-[color:var(--ot-text)]">
            Remark
          </div>
          <div class="text-sm text-[color:var(--ot-text-muted)]">
            {{ detailImport.remark }}
          </div>
        </div>

        <section
          v-if="detailFailedRows.length"
          class="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/20"
        >
          <div class="mb-3 text-sm font-semibold text-[color:var(--ot-text)]">
            Failed Rows
          </div>

          <div class="grid gap-2 md:grid-cols-2">
            <div
              v-for="row in detailFailedRows"
              :key="`${row.rawRowNo || row.rowNo || row.row || ''}-${row.message || row.reason || ''}`"
              class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-sm"
            >
              <div class="font-semibold text-[color:var(--ot-text)]">
                Row {{ row.rawRowNo || row.rowNo || row.row || '—' }}
              </div>
              <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                {{ row.message || row.reason || formatIssues(row.issues) }}
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="detailRecords.length"
          class="rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
        >
          <div class="border-b border-[color:var(--ot-border)] px-4 py-3 text-sm font-semibold text-[color:var(--ot-text)]">
            Imported Record Preview
          </div>

          <DataTable
            :value="detailRecords"
            scrollable
            scrollHeight="360px"
            tableStyle="min-width: 70rem"
            class="attendance-import-detail-table"
          >
            <Column field="attendanceDate" header="Date" style="min-width: 9rem" />
            <Column field="employeeNo" header="Employee No" style="min-width: 10rem" />
            <Column field="employeeName" header="Employee Name" style="min-width: 14rem" />
            <Column field="clockIn" header="Clock In" style="min-width: 8rem" />
            <Column field="clockOut" header="Clock Out" style="min-width: 8rem" />
            <Column field="status" header="Status" style="min-width: 10rem">
              <template #body="{ data }">
                <Tag
                  :value="data.status || '-'"
                  :severity="getImportStatusSeverity(data.status)"
                  class="attendance-tag"
                />
              </template>
            </Column>
            <Column header="Issues" style="min-width: 22rem">
              <template #body="{ data }">
                <div class="line-clamp-2 text-sm text-[color:var(--ot-text-muted)]">
                  {{ formatIssues(data.validationIssues) }}
                </div>
              </template>
            </Column>
          </DataTable>
        </section>
      </div>

      <div
        v-else
        class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
      >
        No import detail found.
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.attendance-import-table .p-datatable-thead > tr > th),
:deep(.attendance-import-detail-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.attendance-import-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  height: 76px !important;
  vertical-align: middle !important;
}

:deep(.attendance-import-detail-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  vertical-align: middle !important;
}

:deep(.p-tag.attendance-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}

.attendance-metric-box,
.attendance-stat-box {
  border: 1px solid var(--ot-border);
  background: var(--ot-bg);
  border-radius: 1rem;
  padding: 0.9rem;
}

.attendance-metric-label,
.attendance-stat-label {
  margin-bottom: 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ot-text-muted);
}

.attendance-metric-value {
  word-break: break-word;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--ot-text);
}

.attendance-stat-value {
  word-break: break-word;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--ot-text);
}

.line-clamp-2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
</style>