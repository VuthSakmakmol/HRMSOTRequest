<!-- frontend/src/modules/attendance/views/AttendanceImportView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import AttendanceImportDialog from '@/modules/attendance/components/AttendanceImportDialog.vue'
import HolidayDatePicker from '@/modules/calendar/components/HolidayDatePicker.vue'
import { useAuthStore } from '@/modules/auth/auth.store'
import {
  getAttendanceImportById,
  getAttendanceImports,
} from '@/modules/attendance/attendance.api'

const toast = useToast()
const auth = useAuthStore()
const { t } = useI18n()

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
  periodFrom: '',
  periodTo: '',
  sortField: 'createdAt',
  sortOrder: -1,
})

const statusOptions = computed(() => [
  { label: t('common.allStatus'), value: '' },
  { label: t('attendance.statusLabel.processing'), value: 'PROCESSING' },
  { label: t('attendance.statusLabel.success'), value: 'SUCCESS' },
  { label: t('attendance.statusLabel.partialSuccess'), value: 'PARTIAL_SUCCESS' },
  { label: t('attendance.statusLabel.failed'), value: 'FAILED' },
])

const totalImports = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const loadedLabel = computed(() =>
  t('common.loaded', {
    loaded: loadedCount.value,
    total: totalImports.value,
  }),
)
const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalImports.value > PAGE_SIZE)

const canImportAttendance = computed(() => {
  if (auth.user?.isRootAdmin || auth.isRootAdmin) return true
  if (auth.hasPermission?.('ATTENDANCE_IMPORT')) return true
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
  const failedRows =
    latestImportResult.value?.failedRows ||
    latestImportResult.value?.failedRowPreview ||
    latestImportResult.value?.errors ||
    []

  return Array.isArray(failedRows) ? failedRows.slice(0, 8) : []
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
  const failedRows =
    selectedImportDetail.value?.failedRows ||
    selectedImportDetail.value?.failedRowPreview ||
    selectedImportDetail.value?.errors ||
    []

  return Array.isArray(failedRows) ? failedRows : []
})

const detailRecords = computed(() => {
  const records =
    selectedImportDetail.value?.records ||
    selectedImportDetail.value?.items ||
    selectedImportDetail.value?.attendanceRecords ||
    []

  return Array.isArray(records) ? records : []
})

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function formatDateDMY(value) {
  if (!value) return '—'

  const raw = s(value)

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return raw || '—'

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()

  return `${dd}/${mm}/${yyyy}`
}

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return s(value) || '—'

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function formatPeriod(row) {
  const from = s(row?.periodFrom)
  const to = s(row?.periodTo)

  if (from && to && from !== to) return `${formatDateDMY(from)} → ${formatDateDMY(to)}`
  if (from) return formatDateDMY(from)
  if (to) return formatDateDMY(to)

  return '—'
}

function formatIssues(value) {
  if (Array.isArray(value) && value.length) return value.join(', ')
  if (typeof value === 'string' && value.trim()) return value.trim()
  return '—'
}

function getImportStatusSeverity(status) {
  const normalized = upper(status)

  if (normalized === 'SUCCESS') return 'success'
  if (normalized === 'PARTIAL_SUCCESS') return 'warning'
  if (normalized === 'FAILED') return 'danger'
  if (normalized === 'PROCESSING') return 'info'

  return 'secondary'
}

function getRecordStatusSeverity(status) {
  const normalized = upper(status)

  if (['SUCCESS', 'VALID', 'PRESENT', 'IMPORTED'].includes(normalized)) return 'success'
  if (['WARNING', 'DUPLICATE', 'PARTIAL_SUCCESS'].includes(normalized)) return 'warning'
  if (['FAILED', 'ERROR', 'INVALID', 'ABSENT'].includes(normalized)) return 'danger'
  if (['PROCESSING', 'PENDING'].includes(normalized)) return 'info'

  return 'secondary'
}

function formatImportStatusLabel(status) {
  const normalized = upper(status)

  const labels = {
    PROCESSING: t('attendance.statusLabel.processing'),
    SUCCESS: t('attendance.statusLabel.success'),
    PARTIAL_SUCCESS: t('attendance.statusLabel.partialSuccess'),
    FAILED: t('attendance.statusLabel.failed'),
  }

  return labels[normalized] || normalized || '-'
}

function formatRecordStatusLabel(status) {
  const normalized = upper(status)

  const labels = {
    SUCCESS: t('attendance.statusLabel.success'),
    VALID: t('attendance.statusLabel.valid'),
    PRESENT: t('attendance.statusLabel.present'),
    IMPORTED: t('attendance.statusLabel.imported'),
    FAILED: t('attendance.statusLabel.failed'),
    ERROR: t('attendance.statusLabel.error'),
    INVALID: t('attendance.statusLabel.invalid'),
    ABSENT: t('attendance.statusLabel.absent'),
    WARNING: t('attendance.statusLabel.warning'),
    DUPLICATE: t('attendance.statusLabel.duplicate'),
    PROCESSING: t('attendance.statusLabel.processing'),
    PENDING: t('attendance.statusLabel.pending'),
  }

  return labels[normalized] || normalized || '-'
}

function formatImportNo(row) {
  return s(row?.importNo || row?.attendanceImportNo) || '—'
}

function formatFileName(row) {
  return s(row?.fileName) || '—'
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: s(filters.search) || undefined,
    status: filters.status || undefined,
    periodFrom: s(filters.periodFrom) || undefined,
    periodTo: s(filters.periodTo) || undefined,
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
    const startIndex = (page - 1) * PAGE_SIZE

    totalRecords.value = total

    if (replace) {
      const nextRows = total > 0 ? Array.from({ length: total }, () => null) : []

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const nextRows = [...rows.value]

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
      summary: t('attendance.message.loadFailed'),
      detail:
        error?.response?.data?.message ||
        error?.message ||
        t('attendance.import.noImports'),
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
    createdAt: 'createdAt',
    importedAt: 'importedAt',
    rowCount: 'rowCount',
    successRowCount: 'successRowCount',
    failedRowCount: 'failedRowCount',
    duplicateRowCount: 'duplicateRowCount',
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
  filters.periodFrom = ''
  filters.periodTo = ''
  filters.sortField = 'createdAt'
  filters.sortOrder = -1

  reloadFirstPage({ keepVisible: true })
}

function refresh() {
  reloadFirstPage({ keepVisible: true })
}

async function openImportDetail(row) {
  const importId = s(row?.id || row?._id)

  if (!importId) {
    toast.add({
      severity: 'warn',
      summary: t('attendance.message.missingImportId'),
      detail: t('attendance.message.missingImportIdDetail'),
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
      summary: t('attendance.message.detailLoadFailed'),
      detail:
        error?.response?.data?.message ||
        error?.message ||
        t('attendance.import.detailLoadFailed'),
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
  <div class="ot-page-shell">
    <div class="ot-page-actions">
        <Button
          v-if="canImportAttendance"
          :label="t('attendance.import.importAttendance')"
          icon="pi pi-upload"
          size="small"
          @click="importDialogVisible = true"
        />

        <Button
          :label="t('common.refresh')"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          :loading="backgroundLoading"
          @click="refresh"
        />

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />
      </div>

    <section
      v-if="latestImportInfo"
      class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/20"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex items-center gap-2 text-base font-bold text-[color:var(--ot-text)]">
              <i class="pi pi-check-circle text-emerald-500" />
              <span>{{ t('attendance.import.latestImportResult') }}</span>
            </div>

            <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
              {{ t('attendance.import.latestImportDescription') }}
            </p>
          </div>

          <Tag
            :value="formatImportStatusLabel(latestImportInfo.status)"
            :severity="getImportStatusSeverity(latestImportInfo.status)"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.importNo') }}</div>
            <div class="attendance-stat-value text-sm">
              {{ latestImportInfo.importNo || '—' }}
            </div>
          </div>

          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.totalRows') }}</div>
            <div class="attendance-stat-value">
              {{ Number(latestImportInfo.rowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-emerald-200 dark:border-emerald-800">
            <div class="attendance-stat-label">{{ t('attendance.field.successRows') }}</div>
            <div class="attendance-stat-value text-emerald-600 dark:text-emerald-400">
              {{ Number(latestImportInfo.successRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-amber-200 dark:border-amber-800">
            <div class="attendance-stat-label">{{ t('attendance.field.failedRows') }}</div>
            <div class="attendance-stat-value text-amber-600 dark:text-amber-400">
              {{ Number(latestImportInfo.failedRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box border-sky-200 dark:border-sky-800">
            <div class="attendance-stat-label">{{ t('attendance.field.duplicateRows') }}</div>
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
          {{ t('attendance.message.partialImportWarning') }}
        </Message>

        <div
          v-if="latestFailedRowsPreview.length"
          class="rounded-2xl border border-amber-200 bg-white/80 p-3 dark:border-amber-800 dark:bg-surface-900"
        >
          <div class="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            {{ t('attendance.import.failedRowPreview') }}
          </div>

          <div class="grid gap-2 md:grid-cols-2">
            <div
              v-for="row in latestFailedRowsPreview"
              :key="`${row.rawRowNo || row.rowNo || row.row || ''}-${row.message || row.reason || ''}`"
              class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-sm"
            >
              <div class="font-bold text-[color:var(--ot-text)]">
                {{ t('attendance.field.row') }} {{ row.rawRowNo || row.rowNo || row.row || '—' }}
              </div>

              <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                {{ row.message || row.reason || formatIssues(row.issues) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ot-filter-bar">
      <div class="ot-field">
        <label class="ot-field-label">{{ t('common.search') }}</label>

        <IconField>
          <InputIcon class="pi pi-search" />

          <InputText
            v-model="filters.search"
            :placeholder="t('attendance.field.searchImportPlaceholder')"
            class="w-full"
            size="small"
            @input="onSearchInput"
          />
        </IconField>
      </div>

      <div class="ot-field">
        <label class="ot-field-label">{{ t('common.status') }}</label>

        <Select
          v-model="filters.status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('common.allStatus')"
          class="w-full"
          size="small"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.periodFrom"
          :label="t('attendance.field.periodFrom')"
          :placeholder="t('attendance.field.periodFrom')"
        />
      </div>

      <div class="ot-field">
        <HolidayDatePicker
          v-model="filters.periodTo"
          :label="t('attendance.field.periodTo')"
          :placeholder="t('attendance.field.periodTo')"
        />
      </div>

      <div class="ot-filter-actions">
        <span class="ot-loaded-badge">
          {{ loadedLabel }}
        </span>

        <Button
          :label="t('common.clear')"
          icon="pi pi-filter-slash"
          severity="secondary"
          outlined
          size="small"
          @click="clearFilters"
        />
      </div>
    </section>

    <section class="ot-table-card">
      <div class="ot-table-toolbar">
        <div>
          <h2 class="ot-table-title">
            {{ t('attendance.import.importHistory') }}
          </h2>
        </div>

        <div class="ot-table-actions">
          <span
            v-if="backgroundLoading && hasAnyData"
            class="ot-loaded-badge"
          >
            <i class="pi pi-spin pi-spinner" />
            {{ t('attendance.message.updating') }}
          </span>
        </div>
      </div>

      <div class="ot-table-wrapper">
        <DataTable
          :value="rows"
          lazy
          removable-sort
          scrollable
          scroll-height="500px"
          :sort-field="filters.sortField"
          :sort-order="filters.sortOrder"
          table-style="width: max-content; min-width: 100%;"
          class="ot-data-table ot-data-table-compact"
          :virtual-scroller-options="useVirtualScroll ? {
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
              class="ot-empty-state"
            >
              <div class="ot-empty-icon">
                <i class="pi pi-upload" />
              </div>

              <div class="ot-empty-title">
                {{ t('attendance.message.noDataFound') }}
              </div>

              <div class="ot-empty-text">
                {{ t('attendance.import.noImports') }}
              </div>
            </div>
          </template>

          <Column
            field="importNo"
            :header="t('attendance.field.importNo')"
            sortable
            style="min-width: 11rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="font-bold text-[color:var(--ot-text)]"
              >
                {{ formatImportNo(data) }}
              </span>
            </template>
          </Column>

          <Column
            field="fileName"
            :header="t('attendance.field.fileName')"
            sortable
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex min-w-0 items-center gap-2"
                :title="formatFileName(data)"
              >
                <i class="pi pi-file-excel text-emerald-500" />
                <span class="truncate">
                  {{ formatFileName(data) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.period')"
            style="min-width: 12rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="text-sm text-[color:var(--ot-text)]"
              >
                {{ formatPeriod(data) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('attendance.field.rows')"
            style="min-width: 25rem"
          >
            <template #body="{ data }">
              <div
                v-if="data"
                class="flex flex-wrap items-center gap-1.5"
              >
                <span class="count-pill is-total">
                  {{ t('attendance.field.totalRows') }} {{ Number(data.rowCount || 0) }}
                </span>

                <span class="count-pill is-success">
                  {{ t('attendance.field.successRows') }} {{ Number(data.successRowCount || 0) }}
                </span>

                <span class="count-pill is-failed">
                  {{ t('attendance.field.failedRows') }} {{ Number(data.failedRowCount || 0) }}
                </span>

                <span class="count-pill is-duplicate">
                  {{ t('attendance.field.duplicateRows') }} {{ Number(data.duplicateRowCount || 0) }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            field="status"
            :header="t('common.status')"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                v-if="data"
                :value="formatImportStatusLabel(data.status)"
                :severity="getImportStatusSeverity(data.status)"
              />
            </template>
          </Column>

          <Column
            field="createdAt"
            :header="t('attendance.field.importedAt')"
            sortable
            style="min-width: 13rem"
          >
            <template #body="{ data }">
              <span
                v-if="data"
                class="text-sm text-[color:var(--ot-text)]"
              >
                {{ formatDateTime(data.importedAt || data.createdAt) }}
              </span>
            </template>
          </Column>

          <Column
            :header="t('common.actions')"
            style="width: 7rem; min-width: 7rem"
          >
            <template #body="{ data }">
              <Button
                v-if="data"
                :label="t('common.detail')"
                icon="pi pi-eye"
                outlined
                size="small"
                @click="openImportDetail(data)"
              />
            </template>
          </Column>
        </DataTable>
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
      :header="t('attendance.import.importDetail')"
    >
      <div
        v-if="detailLoading"
        class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
      >
        {{ t('attendance.import.loadingImportDetail') }}
      </div>

      <div
        v-else-if="detailImport"
        class="flex flex-col gap-4"
      >
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="attendance-metric-box">
            <div class="attendance-metric-label">{{ t('attendance.field.importNo') }}</div>

            <div class="attendance-metric-value">
              {{ detailImport.importNo || '—' }}
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">{{ t('common.status') }}</div>

            <div class="mt-1">
              <Tag
                :value="formatImportStatusLabel(detailImport.status)"
                :severity="getImportStatusSeverity(detailImport.status)"
              />
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">{{ t('attendance.field.period') }}</div>

            <div class="attendance-metric-value">
              {{ formatPeriod(detailImport) }}
            </div>
          </div>

          <div class="attendance-metric-box">
            <div class="attendance-metric-label">{{ t('attendance.field.importedAt') }}</div>

            <div class="attendance-metric-value">
              {{ formatDateTime(detailImport.importedAt || detailImport.createdAt) }}
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.totalRows') }}</div>
            <div class="attendance-stat-value">
              {{ Number(detailImport.rowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.successRows') }}</div>
            <div class="attendance-stat-value text-emerald-600">
              {{ Number(detailImport.successRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.failedRows') }}</div>
            <div class="attendance-stat-value text-amber-600">
              {{ Number(detailImport.failedRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.duplicateRows') }}</div>
            <div class="attendance-stat-value text-sky-600">
              {{ Number(detailImport.duplicateRowCount || 0) }}
            </div>
          </div>

          <div class="attendance-stat-box">
            <div class="attendance-stat-label">{{ t('attendance.field.overriddenRows') }}</div>
            <div class="attendance-stat-value">
              {{ Number(detailImport.overriddenRowCount || 0) }}
            </div>
          </div>
        </div>

        <Message
          v-if="detailFailedRows.length"
          severity="warn"
          :closable="false"
        >
          {{ t('attendance.message.failedRowsWarning') }}
        </Message>

        <div
          v-if="detailFailedRows.length"
          class="rounded-2xl border border-[color:var(--ot-border)] p-3"
        >
          <div class="mb-3 text-sm font-bold text-[color:var(--ot-text)]">
            {{ t('attendance.field.failedRows') }}
          </div>

          <div class="grid gap-2 md:grid-cols-2">
            <div
              v-for="row in detailFailedRows"
              :key="`${row.rawRowNo || row.rowNo || row.row || ''}-${row.message || row.reason || ''}`"
              class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-bg)] px-3 py-2 text-sm"
            >
              <div class="font-bold text-[color:var(--ot-text)]">
                {{ t('attendance.field.row') }} {{ row.rawRowNo || row.rowNo || row.row || '—' }}
              </div>

              <div class="mt-0.5 text-xs text-[color:var(--ot-text-muted)]">
                {{ row.message || row.reason || formatIssues(row.issues) }}
              </div>
            </div>
          </div>
        </div>

        <DataTable
          :value="detailRecords"
          scrollable
          scroll-height="420px"
          table-style="width: max-content; min-width: 100%;"
          class="ot-data-table ot-data-table-compact"
        >
          <template #empty>
            <div class="py-8 text-center text-sm text-[color:var(--ot-text-muted)]">
              {{ t('attendance.import.noImportRecords') }}
            </div>
          </template>

          <Column
            :header="t('attendance.field.row')"
            style="min-width: 5rem"
          >
            <template #body="{ data }">
              {{ data.rawRowNo || '—' }}
            </template>
          </Column>

          <Column
            :header="t('attendance.field.employee')"
            style="min-width: 16rem"
          >
            <template #body="{ data }">
              <div class="flex flex-col">
                <span class="font-bold text-[color:var(--ot-text)]">
                  {{ data.employeeNo || data.importedEmployeeId || '—' }}
                </span>

                <span class="text-xs text-[color:var(--ot-text-muted)]">
                  {{ data.employeeName || data.importedEmployeeName || '—' }}
                </span>
              </div>
            </template>
          </Column>

          <Column
            :header="t('common.date')"
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              {{ formatDateDMY(data.attendanceDate) }}
            </template>
          </Column>

          <Column
            :header="t('attendance.field.clockIn')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              {{ data.clockIn || '—' }}
            </template>
          </Column>

          <Column
            :header="t('attendance.field.clockOut')"
            style="min-width: 7rem"
          >
            <template #body="{ data }">
              {{ data.clockOut || '—' }}
            </template>
          </Column>

          <Column
            :header="t('common.status')"
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                :value="formatRecordStatusLabel(data.status || data.importedStatus)"
                :severity="getRecordStatusSeverity(data.status || data.importedStatus)"
              />
            </template>
          </Column>

          <Column
            :header="t('attendance.field.issues')"
            style="min-width: 18rem"
          >
            <template #body="{ data }">
              <span class="ot-truncate-2">
                {{ formatIssues(data.validationIssues || data.issues) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </div>

      <div
        v-else
        class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
      >
        {{ t('attendance.import.noImportDetail') }}
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.attendance-stat-box,
.attendance-metric-box {
  border: 1px solid var(--ot-border);
  border-radius: 1rem;
  background: var(--ot-surface);
  padding: 0.85rem 1rem;
}

.attendance-stat-label,
.attendance-metric-label {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ot-text-muted);
}

.attendance-stat-value,
.attendance-metric-value {
  margin-top: 0.25rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ot-text);
}

.count-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.count-pill.is-total {
  background: rgba(100, 116, 139, 0.12);
  color: rgb(71, 85, 105);
}

.count-pill.is-success {
  background: rgba(16, 185, 129, 0.12);
  color: rgb(4, 120, 87);
}

.count-pill.is-failed {
  background: rgba(245, 158, 11, 0.14);
  color: rgb(180, 83, 9);
}

.count-pill.is-duplicate {
  background: rgba(14, 165, 233, 0.12);
  color: rgb(3, 105, 161);
}
</style>